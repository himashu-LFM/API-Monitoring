"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { buildUsageSeries, rangeLabels } from "@/lib/chart";
import { UsageChart } from "@/components/charts/usage-chart";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
            value === o.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function UsageOverview() {
  const { services } = useAppState();
  const [selected, setSelected] = useState<string>("all");
  const [days, setDays] = useState<number>(30);

  const labels = useMemo(() => rangeLabels(days), [days]);
  const series = useMemo(() => buildUsageSeries(services, selected, days), [services, selected, days]);

  const apiOptions = [{ label: "All APIs", value: "all" }, ...services.map((s) => ({ label: s.name, value: s.id }))];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Usage overview</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={apiOptions} value={selected} onChange={setSelected} />
          <Segmented options={RANGES.map((r) => ({ label: r.label, value: r.days }))} value={days} onChange={setDays} />
        </div>
      </CardHeader>
      <CardContent>
        <UsageChart labels={labels} series={series} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded" style={{ background: s.color }} />{s.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
