"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ServiceAvatar } from "@/components/common/service-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { UsageProgress } from "@/components/common/usage-progress";
import { getUsageStatus } from "@/lib/status";
import { pct, fmtNum, fmtDateShort, daysUntil } from "@/lib/format";
import type { ApiService } from "@/lib/types";

export function ApiCard({ service: s }: { service: ApiService }) {
  const hasNumbers = s.usage != null && s.limit != null;
  const p = hasNumbers ? pct(s.usage!, s.limit!) : 0;
  const pending = hasNumbers ? null : (s.fetchState === "failed" ? "Unavailable" : "Loading…");
  const d = daysUntil(s.renewalDate);
  return (
    <Link href={`/apis/${s.id}`} className="block focus:outline-none">
      <Card className="gap-4 p-4 transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <ServiceAvatar name={s.name} color={s.color} />
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.provider}</div>
            </div>
          </div>
          {hasNumbers ? <StatusBadge status={getUsageStatus(p)} /> : <span className="text-xs text-muted-foreground">{pending}</span>}
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="tabular-nums text-muted-foreground">
              {hasNumbers ? `${fmtNum(s.usage!)} / ${fmtNum(s.limit!)} ${s.unit}` : "—"}
            </span>
            {hasNumbers && <span className="font-medium tabular-nums">{p}%</span>}
          </div>
          {hasNumbers
            ? <UsageProgress percentage={p} />
            : <div className="h-2 animate-pulse rounded bg-muted" />}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
          <div>
            <div className="text-muted-foreground">Remaining</div>
            <div className="mt-0.5 font-medium tabular-nums">{hasNumbers ? fmtNum(s.limit! - s.usage!) : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Renewal</div>
            <div className="mt-0.5 font-medium">{fmtDateShort(s.renewalDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Days left</div>
            <div className="mt-0.5 font-medium tabular-nums">{d}d</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
