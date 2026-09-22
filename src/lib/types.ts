export type Health = "ok" | "warn" | "high" | "crit";
export type FetchStatus = "ok" | "not_configured" | "error";
export type Severity = "crit" | "warn" | "info";

/**
 * Live status of one monitored service, returned by /api/usage.
 * `usage` / `limit` are null when a provider is not configured, errored,
 * or doesn't expose usage (renewal-only). The shape is provider-agnostic:
 * each adapter fills it from its own real API.
 */
export interface ServiceStatus {
  id: string;
  name: string;
  provider: string;
  color: string;
  unit: string;
  usage: number | null;
  limit: number | null;
  renewalISO: string | null;
  usageTracked: boolean;
  status: FetchStatus;
  message?: string;
}

export interface UsageResponse {
  services: ServiceStatus[];
  fetchedAt: string;
}

/** Alerts are derived live from statuses + thresholds — not stored mock data. */
export interface Alert {
  id: string;
  title: string;
  serviceId: string;
  severity: Severity;
  timeLabel: string;
}
