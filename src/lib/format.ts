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
