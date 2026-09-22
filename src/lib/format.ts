import type { Health } from "./types";

export function pctOf(usage: number | null, limit: number | null): number | null {
  if (usage == null || limit == null || limit <= 0) return null;
  return Math.round((usage / limit) * 100);
}

export function healthClass(p: number): Health {
  return p >= 90 ? "crit" : p >= 75 ? "high" : p >= 50 ? "warn" : "ok";
}

export function healthLabel(p: number): string {
  return p >= 90 ? "Critical" : p >= 75 ? "High Usage" : p >= 50 ? "Warning" : "Healthy";
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86400000);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtNum(n: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}
