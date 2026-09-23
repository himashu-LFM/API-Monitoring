"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { SEVERITY_META, TONE_CLASSES } from "@/lib/status";

export function RecentAlerts() {
  const { alerts } = useAppState();
  const recent = alerts.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent alerts</CardTitle>
        <Link href="/alerts" className="flex items-center gap-1 text-xs font-medium text-info hover:underline">
          View all <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {recent.map((a) => {
            const tone = SEVERITY_META[a.severity].tone;
            const Icon = a.severity === "info" ? Info : AlertTriangle;
            return (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", TONE_CLASSES[tone].bg, TONE_CLASSES[tone].text)}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.timeLabel}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
