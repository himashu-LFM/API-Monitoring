// Pinned "today" so mock day-remaining math is stable across the app.
export const TODAY = new Date("2026-09-22T00:00:00");

export function daysUntil(iso: string): number {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  return Math.round((d.getTime() - TODAY.getTime()) / 86400000);
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
