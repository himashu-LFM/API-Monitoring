"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/states";
import { Segmented } from "@/components/common/segmented";
import { ServiceAvatar } from "@/components/common/service-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { UsageChart } from "@/components/charts/usage-chart";
import { AlertConfiguration } from "./alert-configuration";
import { useAppState } from "@/hooks/use-app-state";
import { getUsageStatus } from "@/lib/status";
import { pct, fmtNum, fmtDate, daysUntil } from "@/lib/format";
import { rangeLabels, usageValues } from "@/lib/chart";

export function ApiDetail({ id }: { id: string }) {
  const { services } = useAppState();
  const service = services.find((s) => s.id === id);
  const [tab, setTab] = useState<"usage" | "remaining">("usage");
  const [days, setDays] = useState(30);

  const labels = useMemo(() => rangeLabels(days), [days]);
  const series = useMemo(() => {
    if (!service) return [];
    const base = usageValues(service, days);
    const data = tab === "remaining" ? base.map((v) => Math.round((100 - v) * 10) / 10) : base;
    return [{ id: service.id, name: `${service.name} ${tab}`, color: service.color, data }];
  }, [service, days, tab]);

  if (!service) {
    return (
      <Card>
        <EmptyState icon={Layers} title="API not found" description="This service may have been removed."
          action={<Link href="/apis" className="text-sm font-medium text-info hover:underline">Back to APIs</Link>} />
      </Card>
    );
  }

  const p = pct(service.usage, service.limit);
  const hasRenewal = !!service.renewalDate;
  const d = hasRenewal ? daysUntil(service.renewalDate) : null;

  const metrics = [
    { label: "Current usage", value: fmtNum(service.usage), sub: service.unit },
    { label: "Usage limit", value: fmtNum(service.limit), sub: `${service.unit}/cycle` },
    { label: "Remaining", value: fmtNum(service.limit - service.usage), sub: `${100 - p}% left` },
    { label: "Usage", value: `${p}%`, sub: getUsageStatus(p) },
    { label: "Renewal", value: hasRenewal ? fmtDate(service.renewalDate) : "No expiry", sub: hasRenewal ? service.billingCycle : "credits don't expire", small: true },
    { label: "Days remaining", value: d != null ? `${d}` : "—", sub: hasRenewal ? "until renewal" : "n/a" },
  ];

  return (
    <div className="space-y-4">
      <Link href="/apis" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Back to APIs
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <ServiceAvatar name={service.name} color={service.color} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{service.name}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">
                <span className="size-1.5 rounded-full bg-ok" /> Connected
              </span>
              {service.live && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                  <span className="size-1.5 rounded-full bg-info" /> Live data
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{service.provider} · Last checked {service.lastChecked}</p>
          </div>
          <StatusBadge status={getUsageStatus(p)} />
        </CardContent>
        {service.liveNote && (
          <CardContent className="pt-0">
            <div className="flex items-start gap-2 rounded-md bg-warn/10 p-3 text-xs text-warn">
              <span>ℹ️</span>
              <span>{service.liveNote}</span>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <Card key={m.label} className="gap-0 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className={m.small ? "mt-1.5 text-sm font-semibold" : "mt-1.5 text-xl font-bold tracking-tight tabular-nums"}>{m.value}</div>
            <div className="mt-0.5 text-xs capitalize text-muted-foreground">{m.sub}</div>
          </Card>
        ))}
      </div>

      {service.thresholdOnly ? (
        // Nothing to chart and nothing to configure: this provider only tells us
        // when it crosses its own fixed thresholds, so a trend line would be
        // invented and our own 50/75% settings could never fire.
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Threshold alerts only</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {service.name} reports usage by webhook when it crosses{" "}
              <span className="font-medium text-foreground">80%</span> and{" "}
              <span className="font-medium text-foreground">100%</span> — there is no
              continuous figure in between, so there is no usage history to chart.
            </p>
            <p>
              Alert thresholds aren&apos;t configurable here either: the 80/100% points are
              fixed by {service.name}, not by this dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Usage history</CardTitle>
              <div className="flex items-center gap-2">
                <Segmented options={[{ label: "Usage", value: "usage" }, { label: "Remaining", value: "remaining" }]} value={tab} onChange={setTab} />
                <Segmented options={[{ label: "7D", value: 7 }, { label: "30D", value: 30 }, { label: "90D", value: 90 }]} value={days} onChange={setDays} />
              </div>
            </CardHeader>
            <CardContent>
              <UsageChart labels={labels} series={series} showThresholds={tab === "usage"} />
            </CardContent>
          </Card>

          <AlertConfiguration serviceId={service.id} />
        </div>
      )}
    </div>
  );
}
