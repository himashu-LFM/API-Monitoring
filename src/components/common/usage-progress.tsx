import { cn } from "@/lib/utils";
import { getUsageStatus, API_STATUS_META, TONE_CLASSES } from "@/lib/status";

export function UsageProgress({ percentage, className }: { percentage: number; className?: string }) {
  const tone = API_STATUS_META[getUsageStatus(percentage)].tone;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", TONE_CLASSES[tone].fill)}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}
