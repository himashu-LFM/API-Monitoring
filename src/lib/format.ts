/**
 * Local midnight of the real current day.
 *
 * This used to be a hard-pinned date ("2026-09-22") so the all-mock build had
 * stable numbers. Now that renewal dates come from real accounts, a pinned
 * "today" silently made every "days remaining" wrong — and drifted further
 * every real day that passed. Keep this a function, not a module constant, so
 * a long-running tab/server can't freeze on the day it started.
 */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(iso: string): number {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  return Math.round((d.getTime() - today().getTime()) / 86400000);
}

/**
 * What to show in the Renewal column for a service with no renewal DATE.
 *
 * An empty `renewalDate` means two opposite things depending on the service, and
 * they were collapsed into one "No expiry" label:
 *   - SadCaptcha: prepaid credits that genuinely never reset.
 *   - YouTube: a quota that resets EVERY DAY at midnight Pacific.
 * "No expiry" on the daily one read as "nothing to worry about", which is the
 * opposite of the truth, so the billing cycle decides the wording.
 */
export function noDateRenewalLabel(billingCycle: string): string {
  switch (billingCycle) {
    case "Daily": return "Renews daily";
    case "Weekly": return "Renews weekly";
    case "Monthly": return "Renews monthly";
    case "Annual": return "Renews yearly";
    default: return "No expiry";
  }
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function pct(usage: number, limit: number): number {
  if (!limit) return 0;
  return Math.round((usage / limit) * 100);
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Roll a known renewal date forward by its billing cycle until it's on or
 * after `ref` (defaults to the real current date — NOT the pinned mock
 * TODAY above, since this drives a real feature). Set the anchor once
 * (any past or future renewal date works) and this keeps returning the
 * correct *next* renewal forever, without manual re-entry each cycle.
 */
export function nextRenewalOnOrAfter(
  anchorISO: string,
  cycle: "Daily" | "Weekly" | "Monthly" | "Annual" | "Custom" | string,
  ref: Date = new Date(),
): string {
  // Everything below works in UTC calendar-date terms throughout, so a
  // real `new Date()` "now" (which is timezone-aware) can't shift the
  // result by a day depending on the server's local offset — the earlier
  // version parsed the anchor as local time but emitted UTC, which is
  // exactly the bug that showed a renewal date one day early for IST.
  const anchor = new Date(anchorISO + "T00:00:00Z");
  if (isNaN(anchor.getTime())) return anchorISO;

  const refDay = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));

  const step = (d: Date) => {
    switch (cycle) {
      case "Daily": d.setUTCDate(d.getUTCDate() + 1); break;
      case "Weekly": d.setUTCDate(d.getUTCDate() + 7); break;
      case "Annual": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
      case "Monthly":
      default: d.setUTCMonth(d.getUTCMonth() + 1); break;
    }
  };

  const d = new Date(anchor);
  let guard = 0;
  while (d.getTime() < refDay.getTime() && guard < 2000) { step(d); guard++; }
  return d.toISOString().slice(0, 10);
}

/**
 * Start date of the CURRENT billing period on or after which usage should
 * be summed — i.e. one cycle before the next renewal. Use this instead of
 * a fixed rolling window (e.g. "last 30 days") when reporting "usage this
 * cycle", since a 30-day window can bleed into the previous cycle.
 */
export function currentPeriodStart(
  anchorISO: string,
  cycle: "Daily" | "Weekly" | "Monthly" | "Annual" | "Custom" | string,
  ref: Date = new Date(),
): string {
  const next = nextRenewalOnOrAfter(anchorISO, cycle, ref);
  const d = new Date(next + "T00:00:00Z");
  switch (cycle) {
    case "Daily": d.setUTCDate(d.getUTCDate() - 1); break;
    case "Weekly": d.setUTCDate(d.getUTCDate() - 7); break;
    case "Annual": d.setUTCFullYear(d.getUTCFullYear() - 1); break;
    case "Monthly":
    default: d.setUTCMonth(d.getUTCMonth() - 1); break;
  }
  return d.toISOString().slice(0, 10);
}
