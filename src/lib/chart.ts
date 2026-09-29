import type { ApiService } from "./types";
import { today, fmtDateShort, pct } from "./format";
import type { ChartSeries } from "@/components/charts/usage-chart";

/** Short date labels for the last `days` days ending today. */
export function rangeLabels(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = today();
    d.setDate(d.getDate() - i);
    out.push(fmtDateShort(d.toISOString().slice(0, 10)));
  }
  return out;
}

/** The ISO dates behind `rangeLabels(days)`, same order. */
function rangeDates(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = today();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Cumulative usage-% for a service that reports REAL per-day numbers.
 *
 * Accumulates within the cycle (that's what the thresholds are about — spend to
 * date against the budget, not one day's spend). Days before the cycle started
 * are `null`, not 0: they belong to the previous cycle, and a 0 there would
 * draw a flat floor that never happened. Recharts leaves those as a gap.
 */
function realCumulativeValues(service: ApiService, days: number): (number | null)[] {
  const byDate = new Map(service.dailyUsage!.map((d) => [d.date, d.value]));
  const first = service.dailyUsage![0]?.date;
  let running = 0;
  return rangeDates(days).map((date) => {
    if (!first || date < first) return null;
    running += byDate.get(date) ?? 0; // a day the provider skipped means no spend
    return service.limit ? pct(running, service.limit) : null;
  });
}

/**
 * Usage-% values for one service over the last `days` days.
 *
 * Only services that report REAL per-day history get a line. There used to be
 * two fallbacks here — a seeded random walk, and a flat line at the current
 * percentage — and both drew a trend that was never measured. Returning nulls
 * lets the caller show "no history" instead of inventing one.
 */
export function usageValues(service: ApiService, days: number): (number | null)[] {
  if (service.dailyUsage?.length) return realCumulativeValues(service, days);
  return Array(days).fill(null);
}

/** True when this service has real measured history to plot. */
export function hasUsageHistory(service: ApiService): boolean {
  return !!service.dailyUsage?.length;
}

/** Build chart series for "all" services or a single selected id. */
export function buildUsageSeries(services: ApiService[], selectedId: string, days: number): ChartSeries[] {
  const list = selectedId === "all" ? services : services.filter((s) => s.id === selectedId);
  return list.map((s) => ({ id: s.id, name: s.name, color: s.color, data: usageValues(s, days) }));
}
