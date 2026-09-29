import "server-only";
import { fetchZyteUsage } from "./providers/zyte";
import { fetchSadCaptchaUsage } from "./providers/sadcaptcha";
import { fetchDecodoUsage } from "./providers/decodo";
import { fetchGoogleUsage } from "./providers/google";
import { sendAlertEmail, emailConfigured } from "./email";
import { highestNotified, recordNotified, pruneOldCycles } from "./alert-state";
import { LOW_BALANCE_FLOOR } from "./alert-rules";

/** Stand-in cycle key for balance-based services, which have no billing cycle. */
const LOW_BALANCE_CYCLE = "lowbalance";

/**
 * Server-side usage-threshold checker.
 *
 * Runs independently of the browser (that's the whole point — an alert that
 * only fires while you're looking at the dashboard is useless). Thresholds
 * come from ALERT_THRESHOLDS, not the UI checkboxes, because those live in
 * the browser's localStorage and the server can't read them.
 */

export interface CheckedService {
  id: string;
  name: string;
  usage: number | null;
  limit: number | null;
  percent: number | null;
  unit: string;
  /** billing-cycle identity, so alert records reset each period */
  cycleKey: string;
  /** threshold just crossed and emailed on this run, if any */
  firedThreshold?: number;
  skipped?: string;
  /**
   * Set for prepaid-credit services (SadCaptcha) that are judged on the balance
   * left rather than a percentage of a cycle. `remaining` is the live balance
   * and `firedLowBalance` marks the run that emailed about it.
   */
  rule?: "low-balance";
  remaining?: number | null;
  firedLowBalance?: boolean;
}

export interface CheckResult {
  checkedAt: string;
  services: CheckedService[];
  emailSent: boolean;
  emailMessage?: string;
}

function thresholds(): number[] {
  const raw = process.env.ALERT_THRESHOLDS?.trim() || "50,75,90,100";
  return raw
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

/** Highest configured threshold that `percent` has reached (0 if none). */
function crossedThreshold(percent: number): number {
  let hit = 0;
  for (const t of thresholds()) if (percent >= t) hit = t;
  return hit;
}

/** Cycle identity so the alert record resets each billing period. */
function cycleKey(renewalDate?: string): string {
  return renewalDate || new Date().toISOString().slice(0, 7); // fall back to the month
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

  const add = (
    id: string, name: string, unit: string,
    ok: boolean, configured: boolean,
    usage: number | null | undefined, limit: number | null | undefined,
    renewalDate: string | undefined, note?: string,
  ) => {
    const key = cycleKey(renewalDate);
    cycleKeys.push(key);
    if (!configured) { checked.push({ id, name, usage: null, limit: null, percent: null, unit, cycleKey: key, skipped: "not configured" }); return; }
    if (!ok || usage == null || limit == null || limit <= 0) {
      checked.push({ id, name, usage: usage ?? null, limit: limit ?? null, percent: null, unit, cycleKey: key, skipped: note || "no usable usage/limit" });
      return;
    }
    checked.push({ id, name, usage, limit, percent: Math.round((usage / limit) * 100), unit, cycleKey: key });
  };

  add("zyte", "Zyte", "$", zyte.ok, zyte.configured, zyte.usage, zyte.limit, zyte.renewalDate, zyte.message);

  // SadCaptcha credits are prepaid and never expire, so there is no cycle to be
  // a percentage of — it's judged purely on the balance left. LOW_BALANCE_CYCLE
  // is a constant "cycle" so the existing dedup store can hold its one record.
  cycleKeys.push(LOW_BALANCE_CYCLE);
  checked.push({
    id: "sadcaptcha", name: "SadCaptcha", unit: "credits",
    cycleKey: LOW_BALANCE_CYCLE, rule: "low-balance",
    usage: sad.usage ?? null, limit: sad.limit ?? null, percent: null,
    remaining: sad.remaining ?? null,
    skipped: !sad.configured ? "not configured"
      : !sad.ok || sad.remaining == null ? (sad.message || "no usable credit balance")
      : undefined,
  });

  // Decodo on datacenter only reports 80%/100% webhook crossings; when that's
  // all we have, `usageGb` is already a percentage against limitGb=100.
  add("decodo", "Decodo", decodo.mode === "webhook" ? "%" : "GB", decodo.ok, decodo.configured, decodo.usageGb, decodo.limitGb, decodo.renewalDate, decodo.message);
  // YouTube quota resets DAILY at midnight PT — use the PT date as the cycle key
  // so the "one email per threshold per cycle" dedup resets every day.
  // (Un-parked on merge: the provider now pins quota_metric to
  // "<service>/default", fixing the inflated figure that forced the pause.)
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  add("google", "YouTube", "units", google.ok, google.configured, google.usage, google.limit, ptDay, google.message);

  return { checked, cycleKeys };
}

function renderEmail(fired: CheckedService[]): { subject: string; html: string; urgent: boolean } {
  const worst = fired.reduce((a, b) => ((b.percent ?? 0) > (a.percent ?? 0) ? b : a));
  const single = fired[0];
  // A low-balance (prepaid credits running out) alert is treated as URGENT.
  const urgent = fired.some((s) => s.firedLowBalance);
  const baseSubject = fired.length > 1
    ? `${fired.length} services need attention`
    : single.firedLowBalance
      ? `${single.name} is critically low — ${(single.remaining ?? 0).toLocaleString()} ${single.unit} left`
      : `${worst.name} reached ${worst.firedThreshold}% usage`;
  const subject = urgent ? `🚨 URGENT: ${baseSubject}` : `API Monitor: ${baseSubject}`;

  const rows = fired.map((s) => s.firedLowBalance ? `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;font-weight:600">${s.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee">${(s.remaining ?? 0).toLocaleString()} ${s.unit} left</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;color:#5b616e">prepaid credits, no expiry</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;color:#b91c1c;font-weight:600">below ${LOW_BALANCE_FLOOR.toLocaleString()}</td>
    </tr>` : `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;font-weight:600">${s.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee">${s.percent}% used</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;color:#5b616e">
        ${s.unit === "$" ? "$" : ""}${(s.usage ?? 0).toLocaleString()}${s.unit !== "$" ? " " + s.unit : ""}
        of ${s.unit === "$" ? "$" : ""}${(s.limit ?? 0).toLocaleString()}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;color:#b91c1c;font-weight:600">${s.firedThreshold}% threshold</td>
    </tr>`).join("");

  const urgentBanner = urgent ? `
    <div style="background:#b91c1c;color:#fff;border-radius:10px;padding:16px 18px;margin:0 0 18px;text-align:center">
      <div style="font-size:13px;letter-spacing:2px;font-weight:700;opacity:.9">🚨 URGENT · IMMEDIATE ATTENTION NEEDED 🚨</div>
      <div style="font-size:20px;font-weight:800;margin-top:6px">A service is about to run out</div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Top it up now to avoid an outage.</div>
    </div>` : "";

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    ${urgentBanner}
    <h2 style="margin:0 0 4px;${urgent ? "color:#b91c1c" : ""}">${fired.every((s) => s.firedLowBalance) ? "Credit balance running low" : "Usage threshold reached"}</h2>
    <p style="margin:0 0 16px;color:#5b616e">Checked ${new Date().toUTCString()}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr>
        <th align="left" style="padding:8px 12px;border-bottom:2px solid #d6d9e0;font-size:12px;color:#5b616e">SERVICE</th>
        <th align="left" style="padding:8px 12px;border-bottom:2px solid #d6d9e0;font-size:12px;color:#5b616e">USAGE</th>
        <th align="left" style="padding:8px 12px;border-bottom:2px solid #d6d9e0;font-size:12px;color:#5b616e">DETAIL</th>
        <th align="left" style="padding:8px 12px;border-bottom:2px solid #d6d9e0;font-size:12px;color:#5b616e">CROSSED</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0;color:#8a909c;font-size:12px">
      You'll only get one email per threshold per billing cycle — and for prepaid
      credits, one email per drop below the floor, re-armed after a top-up.
    </p>
  </div>`;

  return { subject, html, urgent };
}

export async function runUsageCheck(): Promise<CheckResult> {
  const { checked, cycleKeys } = await gather();
  const fired: CheckedService[] = [];

  for (const s of checked) {
    if (s.rule === "low-balance") {
      if (s.remaining == null) continue;
      const armed = (await highestNotified(s.id, s.cycleKey)) === 0;
      if (s.remaining < LOW_BALANCE_FLOOR) {
        // Only the run that crosses the floor mails; later runs stay quiet until
        // a top-up puts the balance back above it and re-arms the rule.
        if (!armed) continue;
        s.firedLowBalance = true;
        fired.push(s); // recorded after a successful send, below
      } else if (!armed) {
        await recordNotified(s.id, s.cycleKey, 0); // topped up — re-arm
      }
      continue;
    }

    if (s.percent == null) continue;
    const hit = crossedThreshold(s.percent);
    if (hit === 0) continue;

    const already = await highestNotified(s.id, s.cycleKey);
    if (hit <= already) continue; // already emailed this threshold (or a higher one) this cycle

    s.firedThreshold = hit;
    fired.push(s);
  }

  await pruneOldCycles(cycleKeys);

  if (fired.length === 0) {
    return { checkedAt: new Date().toISOString(), services: checked, emailSent: false, emailMessage: "nothing new crossed" };
  }
  if (!emailConfigured()) {
    return { checkedAt: new Date().toISOString(), services: checked, emailSent: false, emailMessage: "thresholds crossed but email is not configured" };
  }

  const { subject, html, urgent } = renderEmail(fired);
  const res = await sendAlertEmail(subject, html, { urgent });

  // Record ONLY after the mail actually left. Recording before sending meant a
  // failed or unconfigured send still marked the threshold as "notified", so it
  // could never be retried and the alert was silently lost for the whole cycle.
  // Staying unrecorded means the next run retries — a duplicate mail is a far
  // cheaper failure than a missed one.
  if (res.sent) {
    for (const s of fired) {
      await recordNotified(s.id, s.cycleKey, s.firedLowBalance ? 1 : s.firedThreshold!);
    }
  }

  return { checkedAt: new Date().toISOString(), services: checked, emailSent: res.sent, emailMessage: res.message };
}
