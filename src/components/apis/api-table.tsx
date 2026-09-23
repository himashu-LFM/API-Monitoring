"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ServiceAvatar } from "@/components/common/service-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { UsageProgress } from "@/components/common/usage-progress";
import { getUsageStatus } from "@/lib/status";
import { pct, fmtNum, fmtDateShort, daysUntil } from "@/lib/format";
import type { ApiService } from "@/lib/types";

export function ApiTable({ services }: { services: ApiService[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[200px]">Usage</TableHead>
            <TableHead className="text-right">Limit</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Renewal</TableHead>
            <TableHead>Last checked</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => {
            const p = pct(s.usage, s.limit);
            const d = daysUntil(s.renewalDate);
            return (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() => router.push(`/apis/${s.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ServiceAvatar name={s.name} color={s.color} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{s.name}</span>
                        {s.live && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-1.5 py-0.5 text-[10px] font-semibold text-ok">
                            <span className="size-1 rounded-full bg-ok" />LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.provider}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={getUsageStatus(p)} /></TableCell>
                <TableCell>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="tabular-nums text-muted-foreground">{fmtNum(s.usage)} / {fmtNum(s.limit)}</span>
                    <span className="font-medium tabular-nums">{p}%</span>
                  </div>
                  <UsageProgress percentage={p} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(s.limit)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(s.limit - s.usage)}</TableCell>
                <TableCell>
                  <div className="font-medium tabular-nums">{d}d</div>
                  <div className="text-xs text-muted-foreground">{fmtDateShort(s.renewalDate)}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.lastChecked}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon" aria-label={`Open ${s.name}`}
                    onClick={(e) => { e.stopPropagation(); router.push(`/apis/${s.id}`); }}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
