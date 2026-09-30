"use client";

import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/states";
import { ServiceAvatar } from "@/components/common/service-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { useAppState } from "@/hooks/use-app-state";
import { getUsageStatus } from "@/lib/status";
import { pct, fmtNum, fmtDate, daysUntil, noDateRenewalLabel } from "@/lib/format";
import { LOW_BALANCE_FLOOR } from "@/lib/alert-rules";

export function ApiDetail({ id }: { id: string }) {
  const { services } = useAppState();
  const service = services.find((s) => s.id === id);
  if (!service) {
    return (
      <Card>
        <EmptyState icon={Layers} title="API not found" description="This service may have been removed."
          action={<Link href="/apis" className="text-sm font-medium text-info hover:underline">Back to APIs</Link>} />
      </Card>
    );
  }

  const hasNumbers = service.usage != null && service.limit != null;
  const p = hasNumbers ? pct(service.usage!, service.limit!) : 0;
  const failed = service.fetchState === "failed";
  const waiting = service.fetchState === "waiting";
  // Nothing measured yet: show a dash rather than a number we'd be inventing.
  // "waiting" gets a plain dash too — the card below explains why it's empty,
  // and "Unavailable" would wrongly read as broken.
  const dash = failed ? "Unavailable" : "—";
  const hasRenewal = !!service.renewalDate;
  const d = hasRenewal ? daysUntil(service.renewalDate) : null;

  const metrics = [
    { label: "Current usage", value: hasNumbers ? fmtNum(service.usage!) : dash, sub: service.unit },
    { label: "Usage limit", value: hasNumbers ? fmtNum(service.limit!) : dash, sub: `${service.unit}/cycle` },
    { label: "Remaining", value: hasNumbers ? fmtNum(service.limit! - service.usage!) : dash, sub: hasNumbers ? `${100 - p}% left` : "not measured" },
    { label: "Usage", value: hasNumbers ? `${p}%` : dash, sub: hasNumbers ? getUsageStatus(p) : waiting ? "reports at 80%" : "not measured" },
    { label: "Renewal", value: hasRenewal ? fmtDate(service.renewalDate) : noDateRenewalLabel(service.billingCycle), sub: hasRenewal ? service.billingCycle : service.billingCycle === "Daily" ? "midnight Pacific" : "credits don't expire", small: true },
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

      {service.alertMode ? (
        // Nothing honest to chart and nothing of ours to configure. Either the
        // provider only speaks at its own fixed points, or it gives a single
        // current number with no history endpoint — a trend line would be invented
        // and our own 50/75% settings could never fire correctly.
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {service.alertMode === "fixed-webhook" ? "Threshold alerts only" : "Low-balance alert only"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {service.alertMode === "fixed-webhook" ? (
              <>
                <p>
                  {service.name} reports usage by webhook only when it crosses{" "}
                  <span className="font-medium text-foreground">80%</span> and{" "}
                  <span className="font-medium text-foreground">100%</span>. Between those
                  points it sends nothing, so the figure above moves in two steps rather than
                  continuously — and stays blank until the first one is crossed.
                </p>
                <p>
                  Those two points are fixed by {service.name}, not by this dashboard, so they
                  can&apos;t be changed here.
                </p>
              </>
            ) : (
              <>
                <p>
                  {service.name} only exposes the credits remaining right now — there is no
                  history endpoint, so past usage cannot be shown.
                </p>
                <p>
                  Instead of percentage thresholds, this service emails once when the balance
                  drops below{" "}
                  <span className="font-medium text-foreground">{fmtNum(LOW_BALANCE_FLOOR)}</span>{" "}
                  credits, and re-arms after a top-up.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        // Nothing here any more. The usage-history chart and the Alert
        // configuration panel both used to live in this slot and both were
        // removed: the config's checkboxes only ever wrote to localStorage,
        // which the server-side checker cannot read, and the chart went with
        // it at the same time. The metric cards above carry the live figures.
        null
      )}
    </div>
  );
}
