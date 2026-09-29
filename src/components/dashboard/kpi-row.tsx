"use client";

import { Layers, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { KpiCard } from "@/components/common/kpi-card";
import { useAppState } from "@/hooks/use-app-state";
import { summarize } from "@/lib/alert-engine";

/**
 * Say so when some services haven't reported. Without this the counts silently
 * exclude them and the row reads as if everything had been measured.
 */
function hint(unknown: number, base: string): string {
  return unknown > 0 ? `${base} · ${unknown} not reporting` : base;
}

export function KpiRow() {
  const { services } = useAppState();
  const c = summarize(services);
  const warnish = c.warning + c.high;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total APIs" value={services.length} hint={`${services.length} connected services`} icon={Layers} tone="info" />
      <KpiCard label="Healthy" value={c.healthy} hint={hint(c.unknown, "below 50% usage")} icon={CheckCircle2} tone="ok" />
      <KpiCard label="Warning" value={warnish} hint={hint(c.unknown, "at or above 50%")} icon={AlertTriangle} tone="warn" />
      <KpiCard label="Critical" value={c.critical} hint={hint(c.unknown, "at or above 90%")} icon={ShieldAlert} tone="crit" />
    </div>
  );
}
