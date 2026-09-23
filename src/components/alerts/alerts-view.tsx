"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Search, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/common/segmented";
import { SeverityBadge } from "@/components/common/status-badge";
import { ServiceAvatar } from "@/components/common/service-avatar";
import { EmptyState } from "@/components/common/states";
import { useAppState } from "@/hooks/use-app-state";
import type { Severity } from "@/lib/types";

const STATE_STYLES: Record<string, string> = {
  unread: "bg-info/10 text-info",
  read: "bg-muted text-muted-foreground",
  resolved: "bg-ok/10 text-ok",
};

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-0 p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-1 text-2xl font-bold tabular-nums">{value}</span>
    </Card>
  );
}

export function AlertsView() {
  const { alerts, services, setAlertState } = useAppState();
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [q, setQ] = useState("");
  const [svc, setSvc] = useState("all");

  const nameOf = (id: string) => services.find((s) => s.id === id);

  const filtered = useMemo(() => alerts.filter((a) => {
    if (sev !== "all" && a.severity !== sev) return false;
    if (svc !== "all" && a.serviceId !== svc) return false;
    if (q && !a.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [alerts, sev, svc, q]);

  const counts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    unread: alerts.filter((a) => a.state === "unread").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="All alerts" value={counts.all} />
        <SummaryCard label="Critical" value={counts.critical} />
        <SummaryCard label="Warning" value={counts.warning} />
        <SummaryCard label="Unread" value={counts.unread} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={[
            { label: "All", value: "all" }, { label: "Critical", value: "critical" },
            { label: "Warning", value: "warning" }, { label: "Informational", value: "info" },
          ]}
          value={sev}
          onChange={(v) => setSev(v as "all" | Severity)}
        />
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search alerts…" className="pl-8" aria-label="Search alerts" />
        </div>
        <Select value={svc} onValueChange={(v) => setSvc(v ?? "all")}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by service"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        {filtered.length === 0 ? (
          <EmptyState icon={BellOff} title="No alerts in this view" description="You're all caught up." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Alert</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const s = nameOf(a.serviceId);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className={cn("max-w-[240px]", a.state === "unread" ? "font-semibold" : "font-medium")}>{a.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {s && <ServiceAvatar name={s.name} color={s.color} size={22} />}
                          <span className="text-sm">{s?.name ?? a.serviceId}</span>
                        </div>
                      </TableCell>
                      <TableCell><SeverityBadge severity={a.severity} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.trigger}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.timeLabel}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATE_STYLES[a.state])}>{a.state}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" aria-label="Alert actions"><MoreHorizontal className="size-4" /></Button>}
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAlertState(a.id, "read")}>Mark as read</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAlertState(a.id, "unread")}>Mark as unread</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAlertState(a.id, "resolved")}>Resolve alert</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
