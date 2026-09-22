import type { ServiceStatus, Alert } from "./types";
import { pctOf, daysUntil } from "./format";

/**
 * Derive alerts live from current statuses + per-service thresholds.
 * No stored/mock alerts — everything here reflects the latest fetch.
 */
export function deriveAlerts(services: ServiceStatus[], thresholds: Record<string, number>): Alert[] {
  const out: Alert[] = [];
  for (const s of services) {
    const p = pctOf(s.usage, s.limit);
    const thr = thresholds[s.id] ?? 50;

    if (p != null && p >= 100) {
      out.push({ id: s.id + "-over", serviceId: s.id, severity: "crit", title: `${s.name} is over its limit (${p}%)`, timeLabel: "now" });
    } else if (p != null && p >= 90) {
      out.push({ id: s.id + "-crit", serviceId: s.id, severity: "crit", title: `${s.name} reached ${p}% usage`, timeLabel: "now" });
    } else if (p != null && p >= thr) {
      out.push({ id: s.id + "-thr", serviceId: s.id, severity: "warn", title: `${s.name} crossed ${thr}% threshold (${p}%)`, timeLabel: "now" });
    }

    const d = daysUntil(s.renewalISO);
    if (d != null && d >= 0 && d <= 7) {
      out.push({ id: s.id + "-renew", serviceId: s.id, severity: "info", title: `${s.name} renews in ${d} day${d === 1 ? "" : "s"}`, timeLabel: "upcoming" });
    }

    if (s.status === "error") {
      out.push({ id: s.id + "-err", serviceId: s.id, severity: "warn", title: `${s.name} could not be checked`, timeLabel: s.message ?? "error" });
    }
  }
  const rank = { crit: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
