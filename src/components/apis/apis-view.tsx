"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { ApiTable } from "./api-table";
import { ApiCard } from "./api-card";
import { AddApiModal } from "./add-api-modal";
import { EmptyState } from "@/components/common/states";
import { getUsageStatus } from "@/lib/status";
import { pct, daysUntil } from "@/lib/format";

type SortKey = "name" | "usage" | "renewal";

export function ApisView() {
  const { services } = useAppState();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [sort, setSort] = useState<SortKey>("usage");
  const [view, setView] = useState<"table" | "card">("table");

  const providers = useMemo(() => Array.from(new Set(services.map((s) => s.provider))), [services]);

  const filtered = useMemo(() => {
    let list = services.filter((s) =>
      (s.name + s.provider).toLowerCase().includes(q.toLowerCase()),
    );
    if (status !== "all") list = list.filter((s) => getUsageStatus(pct(s.usage, s.limit)) === status);
    if (provider !== "all") list = list.filter((s) => s.provider === provider);
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "renewal") return daysUntil(a.renewalDate) - daysUntil(b.renewalDate);
      return pct(b.usage, b.limit) - pct(a.usage, a.limit);
    });
    return list;
  }, [services, q, status, provider, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className="pl-8" aria-label="Search services" />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="high">High Usage</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={provider} onValueChange={(v) => setProvider(v ?? "all")}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by provider"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => v && setSort(v as SortKey)}>
          <SelectTrigger className="w-[130px]" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="usage">Sort: Usage</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="renewal">Sort: Renewal</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <button aria-label="Table view" onClick={() => setView("table")} className={cn("rounded p-1.5", view === "table" ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <List className="size-4" />
            </button>
            <button aria-label="Card view" onClick={() => setView("card")} className={cn("rounded p-1.5", view === "card" ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
          <AddApiModal trigger={<Button className="gap-2"><Plus className="size-4" />Add API</Button>} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title="No APIs match your filters" description="Try clearing search or filters, or add a new API." />
        </Card>
      ) : view === "table" ? (
        <Card className="py-0"><ApiTable services={filtered} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => <ApiCard key={s.id} service={s} />)}
        </div>
      )}
    </div>
  );
}
