"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { ServiceAvatar } from "@/components/common/service-avatar";
import { EmptyState } from "@/components/common/states";
import { daysUntil, fmtDate } from "@/lib/format";
import type { ApiService } from "@/lib/types";

export function RenewalList({ services, limit }: { services: ApiService[]; limit?: number }) {
  const router = useRouter();
  // Services with no renewal date (e.g. SadCaptcha — prepaid credits that
  // never expire) simply don't belong in a renewals list.
  const withDates = services.filter((s) => s.renewalDate);
  const sorted = [...withDates].sort((a, b) => daysUntil(a.renewalDate) - daysUntil(b.renewalDate));
  const shown = limit ? sorted.slice(0, limit) : sorted;

  if (shown.length === 0) {
    return <EmptyState icon={CalendarClock} title="No renewals" description="Connected services will show their reset dates here." />;
  }

  return (
    <ul className="divide-y">
      {shown.map((s) => {
        const d = daysUntil(s.renewalDate);
        const tone = d <= 3 ? "text-crit" : d <= 7 ? "text-warn" : "text-foreground";
        return (
          <li key={s.id}>
            <button
              onClick={() => router.push(`/apis/${s.id}`)}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80"
            >
              <ServiceAvatar name={s.name} color={s.color} size={28} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(s.renewalDate)}</div>
              </div>
              <div className="ml-auto text-right">
                <div className={cn("text-sm font-semibold tabular-nums", tone)}>{d}d</div>
                <div className="text-[10px] text-muted-foreground">remaining</div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
