"use client";

import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnomalyBadge } from "@/components/common/status-badge";
import { ANOMALY_META, TONE_CLASSES } from "@/lib/status";
import { MOCK_ANOMALIES } from "@/lib/mock-data";

export function UsageAnomalies() {
  const router = useRouter();
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">Usage anomalies</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {MOCK_ANOMALIES.map((a) => {
            const tone = ANOMALY_META[a.severity].tone;
            return (
              <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md", TONE_CLASSES[tone].bg, TONE_CLASSES[tone].text)}>
                  <TrendingUp className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <AnomalyBadge severity={a.severity} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(`/apis/${a.serviceId}`)}>
                  View API
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
