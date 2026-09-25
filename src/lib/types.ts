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
  usage: number;
  limit: number;
  unit: string;
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
