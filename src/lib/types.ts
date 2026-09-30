export type ApiStatus = "healthy" | "warning" | "high" | "critical";
export type Severity = "critical" | "warning" | "info";
export type AnomalySeverity = "High" | "Medium" | "Low";
export type BillingCycle = "Daily" | "Weekly" | "Monthly" | "Annual" | "Custom";
export type AuthType = "API Key" | "Bearer Token" | "OAuth" | "Custom";
export type AlertState = "unread" | "read" | "resolved";

/** A monitored API / SaaS service. Kept flat so a real provider adapter can fill it later. */
export interface ApiService {
  id: string;
  name: string;
  provider: string;
  color: string;
  /**
   * `null` until a provider has actually reported. Deliberately nullable rather
   * than seeded with a placeholder: a number on screen is a claim, and 0 is as
   * much of a lie as 420 when nothing has been measured yet. Read alongside
   * `fetchState` — null + "loading" is a skeleton, null + "failed" is an error,
   * null + "waiting" is a healthy service that simply has nothing to report.
   */
  usage: number | null;
  limit: number | null;
  unit: string;
  /** Where this service is in the fetch lifecycle. */
  /**
   * Where this service is in the fetch lifecycle.
   *
   * "waiting" exists for providers that are working correctly but stay silent
   * by design — Decodo only speaks at 80% and 100%, so between those points it
   * has nothing to send. Calling that "failed" made a healthy integration look
   * broken, and offered a Retry button that could never help.
   */
  fetchState?: "loading" | "live" | "failed" | "waiting";
  renewalDate: string; // ISO yyyy-mm-dd
  billingCycle: BillingCycle;
  authType: AuthType;
  lastChecked: string; // human label, e.g. "4 minutes ago"
  /** true once real numbers have replaced the mock defaults for this service. */
  live?: boolean;
  /** Set when a live fetch was attempted but failed/needs setup — shown as a note, never hidden. */
  liveNote?: string;
  /**
   * How this service alerts — which also decides what the detail page can
   * honestly show. When set, there is no real usage history to chart and no
   * percentage thresholds of ours to configure, so the UI hides both rather
   * than drawing a fabricated trend line:
   *
   *  - "fixed-webhook": the provider only pings at its own fixed points
   *    (Decodo on datacenter: 80% and 100%, nothing in between).
   *  - "low-balance": prepaid credits with no history endpoint (SadCaptcha);
   *    the alert fires when the remaining balance drops below a floor.
   *
   * Unset means normal percentage thresholds, with chart and config shown.
   */
  alertMode?: "fixed-webhook" | "low-balance";
}

export interface UsagePoint {
  date: string; // ISO
  value: number; // usage percentage 0-100
}

/** Historical usage percentage per service id (oldest -> newest). */
export type UsageHistory = Record<string, UsagePoint[]>;

export interface Alert {
  id: string;
  serviceId: string;
  title: string;
  severity: Severity;
  trigger: string;
  timeLabel: string;
  state: AlertState;
}

export interface NotificationItem {
  id: string;
  serviceId: string;
  title: string;
  severity: Severity;
  timeLabel: string;
  read: boolean;
}

export interface Anomaly {
  id: string;
  serviceId: string;
  title: string;
  description: string;
  severity: AnomalySeverity;
}

export interface Renewal {
  serviceId: string;
  name: string;
  color: string;
  date: string; // ISO
  daysRemaining: number;
}

export interface AlertSettings {
  thresholds: { t50: boolean; t75: boolean; t90: boolean; t100: boolean };
  spikeDetection: boolean;
  spikeSensitivity: "Low" | "Medium" | "High";
  renewalReminders: { d7: boolean; d3: boolean; d1: boolean };
  emailEnabled: boolean;
  email: string;
}

export interface NotificationPrefs {
  emailAlerts: boolean;
  renewalReminders: boolean;
  spikeAlerts: boolean;
}
