import { cn } from "@/lib/utils";
import type { ApiStatus, Severity, AnomalySeverity } from "@/lib/types";
import { API_STATUS_META, SEVERITY_META, ANOMALY_META, TONE_CLASSES, type StatusMeta } from "@/lib/status";

function ToneBadge({ meta, className }: { meta: StatusMeta; className?: string }) {
  const t = TONE_CLASSES[meta.tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", t.bg, t.text, className)}>
      <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: ApiStatus; className?: string }) {
  return <ToneBadge meta={API_STATUS_META[status]} className={className} />;
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return <ToneBadge meta={SEVERITY_META[severity]} className={className} />;
}

export function AnomalyBadge({ severity, className }: { severity: AnomalySeverity; className?: string }) {
  return <ToneBadge meta={ANOMALY_META[severity]} className={className} />;
}
