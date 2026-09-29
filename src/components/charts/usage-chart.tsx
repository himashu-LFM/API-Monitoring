"use client";

import {
  Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip,
} from "recharts";

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  /** `null` = no measurement for that day; Recharts draws a gap rather than a 0. */
  data: (number | null)[];
}

const THRESHOLDS: { y: number; color: string }[] = [
  { y: 50, color: "#d97706" },
  { y: 75, color: "#ea580c" },
  { y: 90, color: "#dc2626" },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.stroke }} />
          {p.name}
          <span className="ml-auto pl-3 font-medium tabular-nums text-popover-foreground">{p.value}%</span>
        </p>
      ))}
    </div>
  );
}

export function UsageChart({ labels, series, showThresholds = true, height = 280, unit = "%" }: {
  labels: string[]; series: ChartSeries[]; showThresholds?: boolean; height?: number; unit?: string;
}) {
  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const s of series) row[s.id] = s.data[i];
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={28} />
        <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}${unit}`} width={44} />
        {showThresholds && THRESHOLDS.map((t) => (
          <ReferenceLine key={t.y} y={t.y} stroke={t.color} strokeDasharray="4 4" strokeOpacity={0.6}
            label={{ value: `${t.y}%`, position: "right", fill: t.color, fontSize: 10 }} />
        ))}
        <Tooltip content={<CustomTooltip />} />
        {series.map((s) => (
          <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color}
            strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
