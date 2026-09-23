import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { TONE_CLASSES, type StatusMeta } from "@/lib/status";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  tone?: StatusMeta["tone"] | "neutral";
}

export function KpiCard({ label, value, hint, icon: Icon, tone = "neutral" }: KpiCardProps) {
  const toneCls = tone === "neutral"
    ? { text: "text-foreground", bg: "bg-muted" }
    : TONE_CLASSES[tone];
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", toneCls.bg, toneCls.text)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}
