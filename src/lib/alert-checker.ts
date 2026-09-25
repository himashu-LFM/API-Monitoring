import "server-only";
import { fetchZyteUsage } from "./providers/zyte";
import { fetchSadCaptchaUsage } from "./providers/sadcaptcha";
import { fetchDecodoUsage } from "./providers/decodo";
import { fetchGoogleUsage } from "./providers/google";
import { sendAlertEmail, emailConfigured } from "./email";
import { highestNotified, recordNotified, pruneOldCycles } from "./alert-state";

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
  add("sadcaptcha", "SadCaptcha", "credits", sad.ok, sad.configured, sad.usage, sad.limit, undefined, sad.message);
  // Decodo on datacenter only reports 80%/100% webhook crossings; when that's
  // all we have, `usageGb` is already a percentage against limitGb=100.
  add("decodo", "Decodo", decodo.mode === "webhook" ? "%" : "GB", decodo.ok, decodo.configured, decodo.usageGb, decodo.limitGb, decodo.renewalDate, decodo.message);
  // YouTube quota resets DAILY at midnight PT — use the PT date as the cycle key
  // so the "one email per threshold per cycle" dedup resets every day.
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  add("google", "YouTube", "units", google.ok, google.configured, google.usage, google.limit, ptDay, google.message);

  return { checked, cycleKeys };
}

function renderEmail(fired: CheckedService[]): { subject: string; html: string } {
  const worst = fired.reduce((a, b) => ((b.percent ?? 0) > (a.percent ?? 0) ? b : a));
  const subject = fired.length === 1
    ? `API Monitor: ${worst.name} reached ${worst.firedThreshold}% usage`
    : `API Monitor: ${fired.length} services crossed a usage threshold`;

  const rows = fired.map((s) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;font-weight:600">${s.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee">${s.percent}% used</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;color:#5b616e">
        ${s.unit === "$" ? "$" : ""}${(s.usage ?? 0).toLocaleString()}${s.unit !== "$" ? " " + s.unit : ""}
        of ${s.unit === "$" ? "$" : ""}${(s.limit ?? 0).toLocaleString()}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e7e9ee;color:#b91c1c;font-weight:600">${s.firedThreshold}% threshold</td>
    </tr>`).join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    <h2 style="margin:0 0 4px">Usage threshold reached</h2>
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
      You'll only get one email per threshold per billing cycle.
    </p>
  </div>`;

  return { subject, html };
}

export async function runUsageCheck(): Promise<CheckResult> {
  const { checked, cycleKeys } = await gather();
  const fired: CheckedService[] = [];

  for (const s of checked) {
    if (s.percent == null) continue;
    const hit = crossedThreshold(s.percent);
    if (hit === 0) continue;

    const already = await highestNotified(s.id, s.cycleKey);
    if (hit <= already) continue; // already emailed this threshold (or a higher one) this cycle

    s.firedThreshold = hit;
    fired.push(s);
    await recordNotified(s.id, s.cycleKey, hit);
  }

  await pruneOldCycles(cycleKeys);

  if (fired.length === 0) {
    return { checkedAt: new Date().toISOString(), services: checked, emailSent: false, emailMessage: "nothing new crossed" };
  }
  if (!emailConfigured()) {
    return { checkedAt: new Date().toISOString(), services: checked, emailSent: false, emailMessage: "thresholds crossed but email is not configured" };
  }

  const { subject, html } = renderEmail(fired);
  const res = await sendAlertEmail(subject, html);
  return { checkedAt: new Date().toISOString(), services: checked, emailSent: res.sent, emailMessage: res.message };
}
