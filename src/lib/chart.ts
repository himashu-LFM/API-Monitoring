import type { ApiService } from "./types";
import { MOCK_USAGE_HISTORY } from "./mock-data";
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

/** Usage-% values for one service over the last `days` days (flat line if no history). */
export function usageValues(service: ApiService, days: number): number[] {
  const hist = MOCK_USAGE_HISTORY[service.id];
  if (hist) return hist.slice(-days).map((p) => p.value);
  return Array(days).fill(pct(service.usage, service.limit));
}

/** Build chart series for "all" services or a single selected id. */
export function buildUsageSeries(services: ApiService[], selectedId: string, days: number): ChartSeries[] {
  const list = selectedId === "all" ? services : services.filter((s) => s.id === selectedId);
  return list.map((s) => ({ id: s.id, name: s.name, color: s.color, data: usageValues(s, days) }));
}
