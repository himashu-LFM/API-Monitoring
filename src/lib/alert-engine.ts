import type { ApiService, UsageHistory, AlertSettings, Severity } from "./types";
import { pct, daysUntil } from "./format";
import { getUsageStatus } from "./status";

/**
 * Reusable alert logic that operates on mock data now, and is shaped so a
 * scheduled backend job can call the same functions against live data later.
 */

export interface EngineAlert {
  serviceId: string;
  title: string;
  severity: Severity;
  trigger: string;
}

/** Fire when a service's usage crosses one of the enabled thresholds. */
export function checkUsageThresholds(service: ApiService, settings: AlertSettings): EngineAlert[] {
  const p = pct(service.usage, service.limit);
  const out: EngineAlert[] = [];
  const rungs: [number, keyof AlertSettings["thresholds"], Severity][] = [
    [100, "t100", "critical"],
    [90, "t90", "critical"],
    [75, "t75", "warning"],
    [50, "t50", "warning"],
  ];
  for (const [threshold, key, severity] of rungs) {
    if (settings.thresholds[key] && p >= threshold) {
      out.push({ serviceId: service.id, title: `${service.name} reached ${threshold}% usage`, severity, trigger: `Threshold ${threshold}%` });
      break; // only the highest crossed rung
    }
  }
  return out;
}

/** Compare latest usage against the trailing average to detect a spike. */
export function detectUsageSpike(
  service: ApiService, history: UsageHistory, settings: AlertSettings,
): EngineAlert | null {
  if (!settings.spikeDetection) return null;
  const points = history[service.id];
  if (!points || points.length < 8) return null;
  const latest = points[points.length - 1].value;
  const prev7 = points.slice(-8, -1);
  const avg = prev7.reduce((s, p) => s + p.value, 0) / prev7.length;
  const sensitivity = { Low: 30, Medium: 20, High: 12 }[settings.spikeSensitivity];
  const jump = latest - avg;
  if (jump >= sensitivity) {
    return { serviceId: service.id, title: `${service.name} usage spike detected`, severity: "warning", trigger: "Anomaly detection" };
  }
  return null;
}

/** Fire renewal reminders at the enabled day-offsets. */
export function checkRenewalReminder(service: ApiService, settings: AlertSettings): EngineAlert | null {
  const d = daysUntil(service.renewalDate);
  const rungs: [number, keyof AlertSettings["renewalReminders"]][] = [
    [1, "d1"], [3, "d3"], [7, "d7"],
  ];
  for (const [days, key] of rungs) {
    if (settings.renewalReminders[key] && d >= 0 && d <= days) {
      return { serviceId: service.id, title: `${service.name} renews in ${d} day${d === 1 ? "" : "s"}`, severity: "info", trigger: "Renewal reminder" };
    }
  }
  return null;
}

/** Convenience roll-up used by the dashboard summary. */
export function summarize(services: ApiService[]) {
  const counts = { healthy: 0, warning: 0, high: 0, critical: 0 };
  for (const s of services) counts[getUsageStatus(pct(s.usage, s.limit))]++;
  return counts;
}
