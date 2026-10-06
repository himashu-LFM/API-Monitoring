import "server-only";
import { fetchZyteUsage } from "./providers/zyte";
import { fetchSadCaptchaUsage } from "./providers/sadcaptcha";
import { fetchDecodoUsage } from "./providers/decodo";
import { fetchGoogleUsage } from "./providers/google";
import { sendAlertEmail, emailConfigured } from "./email";
import { highestNotified, recordNotified, pruneOldCycles } from "./alert-state";
import { daysUntil } from "./format";
import {
  DECODO_CRITICAL_PCT,
  SADCAPTCHA_TIER_WARN, SADCAPTCHA_TIER_CRIT,
  ZYTE_EARLY_PCT, ZYTE_EARLY_MIN_DAYS, ZYTE_CRITICAL_PCT,
  YOUTUBE_PCT, YOUTUBE_CUTOFF_HOUR, YOUTUBE_CUTOFF_MINUTE,
} from "./alert-rules";

/**
 * Server-side usage-alert checker. Runs independently of the browser (an alert
 * that only fires while the dashboard is open is useless). Each service has its
 * own bespoke rule (see alert-rules.ts + evaluate() below), and the alert-state
 * store dedups so a given rule emails only once per cycle.
 */

/** SadCaptcha has no billing cycle, so it uses a constant cycle key. */
const SADCAPTCHA_CYCLE = "lowbalance";

export interface CheckedService {
  id: string;
  name: string;
  usage: number | null;
  limit: number | null;
  percent: number | null;
  remaining?: number | null;
  /** Decodo only: a threshold-crossing webhook arrived this cycle (number may be unreadable). */
  thresholdCrossed?: boolean;
  unit: string;
  renewalDate?: string;
  /** cycle identity, so alert records reset each period (daily/monthly) */
  cycleKey: string;
  skipped?: string;
  // Set on the run that fires an alert for this service:
  firedLevel?: number;   // severity level used for dedup (higher = more severe)
  firedReason?: string;  // human sentence for the email
  urgent?: boolean;      // drives the red URGENT styling + high-priority headers
}

export interface CheckResult {
  checkedAt: string;
  services: CheckedService[];
  emailSent: boolean;
  emailMessage?: string;
}

/** Current wall-clock in US Pacific (where YouTube's daily quota resets). */
function pacificHM(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hourCycle: "h23",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { hour: g("hour"), minute: g("minute") };
}

async function gather(): Promise<{ checked: CheckedService[]; cycleKeys: string[] }> {
  const [zyte, sad, decodo, google] = await Promise.all([
    fetchZyteUsage(),
    fetchSadCaptchaUsage(),
    fetchDecodoUsage(),
    fetchGoogleUsage(),
  ]);

  const checked: CheckedService[] = [];
  const cycleKeys: string[] = [];
  const pct = (u?: number | null, l?: number | null) =>
    u != null && l != null && l > 0 ? Math.round((u / l) * 100) : null;

  // Zyte — USD spend vs budget over a billing cycle.
  const zyteCycle = zyte.renewalDate || new Date().toISOString().slice(0, 7);
  cycleKeys.push(zyteCycle);
  checked.push({
    id: "zyte", name: "Zyte", unit: "$", cycleKey: zyteCycle, renewalDate: zyte.renewalDate,
    usage: zyte.usage ?? null, limit: zyte.limit ?? null, percent: pct(zyte.usage, zyte.limit),
    skipped: !zyte.configured ? "not configured" : (!zyte.ok || zyte.usage == null || zyte.limit == null) ? (zyte.message || "no usable usage/limit") : undefined,
  });

  // SadCaptcha — prepaid credits remaining (constant cycle).
  cycleKeys.push(SADCAPTCHA_CYCLE);
  checked.push({
    id: "sadcaptcha", name: "SadCaptcha", unit: "credits", cycleKey: SADCAPTCHA_CYCLE,
    usage: sad.usage ?? null, limit: sad.limit ?? null, percent: null, remaining: sad.remaining ?? null,
    skipped: !sad.configured ? "not configured" : (!sad.ok || sad.remaining == null) ? (sad.message || "no usable credit balance") : undefined,
  });

  // Decodo — % of plan (webhook mode reports the % directly).
  const decodoCycle = decodo.renewalDate || new Date().toISOString().slice(0, 7);
  cycleKeys.push(decodoCycle);
  checked.push({
    id: "decodo", name: "Decodo", unit: decodo.mode === "webhook" ? "%" : "GB", cycleKey: decodoCycle, renewalDate: decodo.renewalDate,
    usage: decodo.usageGb ?? null, limit: decodo.limitGb ?? null, percent: pct(decodo.usageGb, decodo.limitGb),
    thresholdCrossed: decodo.thresholdCrossed === true,
    // A crossing signal is enough to evaluate, even with no readable number —
    // otherwise an unparseable webhook marks Decodo skipped and silences it.
    skipped: !decodo.configured ? "not configured"
      : decodo.thresholdCrossed === true ? undefined
      : (!decodo.ok || decodo.usageGb == null || decodo.limitGb == null) ? (decodo.message || "no event yet")
      : undefined,
  });

  // YouTube Data API — daily quota, resets midnight PT (cycle = PT date).
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  cycleKeys.push(ptDay);
  checked.push({
    id: "google", name: "YouTube Data API", unit: "units", cycleKey: ptDay,
    usage: google.usage ?? null, limit: google.limit ?? null, percent: pct(google.usage, google.limit),
    skipped: !google.configured ? "not configured" : (!google.ok || google.usage == null || google.limit == null) ? (google.message || "no usable usage/limit") : undefined,
  });

  return { checked, cycleKeys };
}

/** Per-service rule. Returns the fired alert (or null), with a dedup `level`. */
function evaluate(s: CheckedService): { level: number; reason: string; urgent: boolean } | null {
  if (s.skipped) return null;

  if (s.id === "decodo") {
    if (s.percent != null && s.percent >= DECODO_CRITICAL_PCT) {
      return { level: DECODO_CRITICAL_PCT, urgent: true,
        reason: `usage reached ${s.percent}% of the plan (critical at ${DECODO_CRITICAL_PCT}%).` };
    }
    // Decodo sends traffic_usage only at 80% and 100%, so its arrival alone
    // proves the critical threshold was crossed. Fire on that, not on the
    // number — the number has already failed to parse once and cost an alert.
    if (s.thresholdCrossed) {
      return { level: DECODO_CRITICAL_PCT, urgent: true,
        reason: `Decodo reported that traffic crossed its ${DECODO_CRITICAL_PCT}% threshold. The exact percentage couldn't be read from the webhook — check the Decodo dashboard for the current figure.` };
    }
    return null;
  }

  if (s.id === "sadcaptcha") {
    if (s.remaining == null) return null;
    if (s.remaining <= SADCAPTCHA_TIER_CRIT) {
      return { level: 2, urgent: true,
        reason: `only ${s.remaining.toLocaleString()} credits left — below the critical floor of ${SADCAPTCHA_TIER_CRIT.toLocaleString()}. Top up now.` };
    }
    if (s.remaining <= SADCAPTCHA_TIER_WARN) {
      return { level: 1, urgent: false,
        reason: `only ${s.remaining.toLocaleString()} credits left — below ${SADCAPTCHA_TIER_WARN.toLocaleString()}. Plan a top-up.` };
    }
    return null;
  }

  if (s.id === "zyte") {
    if (s.percent == null) return null;
    if (s.percent >= ZYTE_CRITICAL_PCT) {
      return { level: 2, urgent: true,
        reason: `spend reached ${s.percent}% of the budget (critical at ${ZYTE_CRITICAL_PCT}%).` };
    }
    const days = s.renewalDate ? daysUntil(s.renewalDate) : 0;
    if (s.percent >= ZYTE_EARLY_PCT && days > ZYTE_EARLY_MIN_DAYS) {
      return { level: 1, urgent: false,
        reason: `${s.percent}% of the budget spent with ${days} days still left in the cycle — burning too fast.` };
    }
    return null;
  }

  if (s.id === "google") {
    if (s.percent == null) return null;
    const { hour, minute } = pacificHM();
    const beforeCutoff = hour < YOUTUBE_CUTOFF_HOUR || (hour === YOUTUBE_CUTOFF_HOUR && minute < YOUTUBE_CUTOFF_MINUTE);
    if (s.percent >= YOUTUBE_PCT && beforeCutoff) {
      return { level: 1, urgent: true,
        reason: `${s.percent}% of today's quota already used before noon PT — likely to run out before the daily reset.` };
    }
    return null;
  }

  return null;
}

function renderEmail(fired: CheckedService[]): { subject: string; html: string; urgent: boolean } {
  const urgent = fired.some((s) => s.urgent);
  const baseSubject = fired.length > 1
    ? `${fired.length} services need attention`
    : `${fired[0].name} — ${fired[0].firedReason}`;
  const subject = (urgent ? "🚨 URGENT: " : "API Monitor: ") + baseSubject;

  const rows = fired.map((s) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e7e9ee;font-weight:600;white-space:nowrap">
        ${s.urgent ? "🔴 " : "🟠 "}${s.name}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e7e9ee;color:#374151">${s.firedReason}</td>
    </tr>`).join("");

  const urgentBanner = urgent ? `
    <div style="background:#b91c1c;color:#fff;border-radius:10px;padding:16px 18px;margin:0 0 18px;text-align:center">
      <div style="font-size:13px;letter-spacing:2px;font-weight:700;opacity:.9">🚨 URGENT · IMMEDIATE ATTENTION NEEDED 🚨</div>
      <div style="font-size:20px;font-weight:800;margin-top:6px">An API is about to hit its limit</div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Act now to avoid an outage.</div>
    </div>` : "";

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    ${urgentBanner}
    <h2 style="margin:0 0 4px;${urgent ? "color:#b91c1c" : ""}">API usage alert</h2>
    <p style="margin:0 0 16px;color:#5b616e">Checked ${new Date().toUTCString()}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr>
        <th align="left" style="padding:8px 12px;border-bottom:2px solid #d6d9e0;font-size:12px;color:#5b616e">SERVICE</th>
        <th align="left" style="padding:8px 12px;border-bottom:2px solid #d6d9e0;font-size:12px;color:#5b616e">WHAT HAPPENED</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0;color:#8a909c;font-size:12px">
      You get one email per rule per cycle — it re-arms when the cycle resets
      (or, for prepaid credits, after a top-up).
    </p>
  </div>`;

  return { subject, html, urgent };
}

export async function runUsageCheck(): Promise<CheckResult> {
  const { checked, cycleKeys } = await gather();
  const fired: CheckedService[] = [];

  for (const s of checked) {
    const result = evaluate(s);
    const already = await highestNotified(s.id, s.cycleKey);

    if (!result) {
      // SadCaptcha has a constant cycle, so re-arm explicitly once it's back
      // above the warning tier (a top-up). Cycle-based services re-arm on their
      // own when the cycleKey rolls over.
      if (s.id === "sadcaptcha" && s.remaining != null && s.remaining > SADCAPTCHA_TIER_WARN && already > 0) {
        await recordNotified(s.id, s.cycleKey, 0);
      }
      continue;
    }

    if (result.level <= already) continue; // already emailed this (or a more severe) level this cycle

    s.firedLevel = result.level;
    s.firedReason = result.reason;
    s.urgent = result.urgent;
    fired.push(s);
  }

  await pruneOldCycles(cycleKeys);

  if (fired.length === 0) {
    return { checkedAt: new Date().toISOString(), services: checked, emailSent: false, emailMessage: "nothing new crossed" };
  }
  if (!emailConfigured()) {
    return { checkedAt: new Date().toISOString(), services: checked, emailSent: false, emailMessage: "rules crossed but email is not configured" };
  }

  const { subject, html, urgent } = renderEmail(fired);
  const res = await sendAlertEmail(subject, html, { urgent });

  // Record ONLY after the mail actually left, so a failed send is retried next
  // run rather than silently marked as notified.
  if (res.sent) {
    for (const s of fired) await recordNotified(s.id, s.cycleKey, s.firedLevel!);
  }

  return { checkedAt: new Date().toISOString(), services: checked, emailSent: res.sent, emailMessage: res.message };
}
