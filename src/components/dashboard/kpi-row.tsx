"use client";

import { Layers, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { KpiCard } from "@/components/common/kpi-card";
import { useAppState } from "@/hooks/use-app-state";
import { summarize } from "@/lib/alert-engine";

export function KpiRow() {
  const { services } = useAppState();
  const c = summarize(services);
  const warnish = c.warning + c.high;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total APIs" value={services.length} hint={`${services.length} connected services`} icon={Layers} tone="info" />
      <KpiCard label="Healthy" value={c.healthy} hint="below 50% usage" icon={CheckCircle2} tone="ok" />
      <KpiCard label="Warning" value={warnish} hint="at or above 50%" icon={AlertTriangle} tone="warn" />
      <KpiCard label="Critical" value={c.critical} hint="at or above 90%" icon={ShieldAlert} tone="crit" />
    </div>
  );
}
