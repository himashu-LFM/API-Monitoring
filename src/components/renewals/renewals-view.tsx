"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { RenewalList } from "./renewal-list";
import { today } from "@/lib/format";
import type { ApiService } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function MonthCalendar({ year, month, services }: { year: number; month: number; services: ApiService[] }) {
  const router = useRouter();
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const now = today();
  const isThisMonth = now.getFullYear() === year && now.getMonth() === month;

  const byDay: Record<number, ApiService[]> = {};
  for (const s of services) {
    const d = new Date(s.renewalDate + "T00:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      (byDay[d.getDate()] ??= []).push(s);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{MONTHS[month]} {year}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {DOW.map((d) => <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}
          {cells.map((d, i) => d === null ? <div key={i} /> : (
            <div key={i} className={cn(
              "flex min-h-14 flex-col gap-1 rounded-md border bg-muted/30 p-1.5",
              isThisMonth && d === now.getDate() && "border-primary ring-1 ring-primary",
            )}>
              <span className="text-[11px] font-medium text-muted-foreground">{d}</span>
              {(byDay[d] ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/apis/${s.id}`)}
                  className="truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold"
                  style={{ background: `${s.color}22`, color: s.color }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RenewalsView() {
  const { services } = useAppState();

  // Skip services with no renewal date (e.g. SadCaptcha — non-expiring credits).
  const dated = services.filter((s) => s.renewalDate);
  const months = Array.from(
    new Set(dated.map((s) => {
      const d = new Date(s.renewalDate + "T00:00:00");
      return `${d.getFullYear()}-${d.getMonth()}`;
    })),
  ).map((k) => { const [y, m] = k.split("-").map(Number); return { year: y, month: m }; })
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {months.map((m) => <MonthCalendar key={`${m.year}-${m.month}`} year={m.year} month={m.month} services={services} />)}
      </div>
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Upcoming</CardTitle></CardHeader>
        <CardContent><RenewalList services={services} /></CardContent>
      </Card>
    </div>
  );
}
