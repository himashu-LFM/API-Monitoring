import type { ApiStatus, Severity, AnomalySeverity } from "./types";

/** Single source of truth for usage-percentage -> status. */
export function getUsageStatus(percentage: number): ApiStatus {
  if (percentage >= 90) return "critical";
  if (percentage >= 75) return "high";
  if (percentage >= 50) return "warning";
  return "healthy";
}

export interface StatusMeta {
  label: string;
  /** semantic tone token used for text/bg classes: ok | warn | high | crit | info */
  tone: "ok" | "warn" | "high" | "crit" | "info";
}

export const API_STATUS_META: Record<ApiStatus, StatusMeta> = {
  healthy: { label: "Healthy", tone: "ok" },
  warning: { label: "Warning", tone: "warn" },
  high: { label: "High Usage", tone: "high" },
  critical: { label: "Critical", tone: "crit" },
};

export const SEVERITY_META: Record<Severity, StatusMeta> = {
  critical: { label: "Critical", tone: "crit" },
  warning: { label: "Warning", tone: "warn" },
  info: { label: "Informational", tone: "info" },
};

export const ANOMALY_META: Record<AnomalySeverity, StatusMeta> = {
  High: { label: "High", tone: "crit" },
  Medium: { label: "Medium", tone: "high" },
  Low: { label: "Low", tone: "warn" },
};

/** Tailwind class fragments per tone — text, subtle bg, and a solid dot. */
export const TONE_CLASSES: Record<StatusMeta["tone"], { text: string; bg: string; dot: string; fill: string }> = {
  ok: { text: "text-ok", bg: "bg-ok/10", dot: "bg-ok", fill: "bg-ok" },
  warn: { text: "text-warn", bg: "bg-warn/10", dot: "bg-warn", fill: "bg-warn" },
  high: { text: "text-high", bg: "bg-high/10", dot: "bg-high", fill: "bg-high" },
  crit: { text: "text-crit", bg: "bg-crit/10", dot: "bg-crit", fill: "bg-crit" },
  info: { text: "text-info", bg: "bg-info/10", dot: "bg-info", fill: "bg-info" },
};
