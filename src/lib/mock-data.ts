import type {
  ApiService, UsageHistory, UsagePoint, Alert, Anomaly, NotificationItem,
  AlertSettings, NotificationPrefs,
} from "./types";
import { today } from "./format";

/**
 * Centralized mock data layer. All fictional — not real provider data.
 * UI components read from here (or the app-state store) and never hardcode
 * their own copies.
 */

export const MOCK_SERVICES: ApiService[] = [
  { id: "zyte", name: "Zyte", provider: "Zyte API", color: "#f97316",
    usage: 420, limit: 1000, unit: "$", renewalDate: "2026-09-30",
    billingCycle: "Monthly", authType: "API Key", lastChecked: "4 minutes ago" },
  { id: "google", name: "Google", provider: "Google Cloud API", color: "#4285f4",
    usage: 78000, limit: 100000, unit: "requests", renewalDate: "2026-10-12",
    billingCycle: "Monthly", authType: "OAuth", lastChecked: "4 minutes ago" },
  { id: "decodo", name: "Decodo", provider: "Decodo Proxy Network", color: "#0ea5e9",
    usage: 67000, limit: 100000, unit: "GB", renewalDate: "2026-10-06",
    billingCycle: "Monthly", authType: "API Key", lastChecked: "4 minutes ago" },
  { id: "hootsuite", name: "Hootsuite", provider: "Hootsuite Social API", color: "#e11d48",
    usage: 91000, limit: 100000, unit: "calls", renewalDate: "2026-09-25",
    billingCycle: "Annual", authType: "OAuth", lastChecked: "4 minutes ago" },
  { id: "sadcaptcha", name: "SadCaptcha", provider: "SadCaptcha API", color: "#a855f7",
    usage: 4200, limit: 10000, unit: "credits", renewalDate: "",
    billingCycle: "Custom", authType: "API Key", lastChecked: "4 minutes ago" },
];

// Deterministic 90-day daily usage-% history so charts look real but stable.
function genHistory(end: number, volatility: number, seed: number, spikeDay?: number): UsagePoint[] {
  const out: UsagePoint[] = [];
  let v = Math.max(4, end - 32);
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 90; i++) {
    v += (end - v) / (90 - i) + (rand() - 0.45) * volatility;
    if (spikeDay !== undefined && i === spikeDay) v += 16;
    v = Math.max(2, Math.min(100, v));
    const d = today();
    d.setDate(d.getDate() - (89 - i));
    out.push({ date: d.toISOString().slice(0, 10), value: Math.round(v * 10) / 10 });
  }
  out[89].value = end;
  return out;
}

export const MOCK_USAGE_HISTORY: UsageHistory = {
  zyte: genHistory(42, 4, 11, 82),
  google: genHistory(78, 5, 29),
  decodo: genHistory(67, 5, 47),
  hootsuite: genHistory(91, 5, 73, 87),
  sadcaptcha: genHistory(42, 4, 19),
};

export const MOCK_ALERTS: Alert[] = [
  { id: "a1", serviceId: "hootsuite", title: "Hootsuite reached 90% usage", severity: "critical", trigger: "Threshold 90%", timeLabel: "Today, 11:42 AM", state: "unread" },
  { id: "a2", serviceId: "decodo", title: "Decodo crossed 50% usage", severity: "warning", trigger: "Threshold 50%", timeLabel: "Yesterday, 4:21 PM", state: "unread" },
  { id: "a3", serviceId: "zyte", title: "Zyte usage spike detected", severity: "warning", trigger: "Anomaly detection", timeLabel: "Yesterday, 1:15 PM", state: "read" },
  { id: "a4", serviceId: "hootsuite", title: "Hootsuite renewal in 3 days", severity: "info", trigger: "Renewal reminder", timeLabel: "Yesterday, 9:00 AM", state: "read" },
  { id: "a5", serviceId: "google", title: "Google reached 75% usage", severity: "warning", trigger: "Threshold 75%", timeLabel: "2 days ago", state: "resolved" },
];

export const MOCK_ANOMALIES: Anomaly[] = [
  { id: "an1", serviceId: "hootsuite", title: "Hootsuite usage spike", description: "Usage increased from 61% to 78% within 3 hours.", severity: "High" },
  { id: "an2", serviceId: "zyte", title: "Zyte usage acceleration", description: "Usage is 24% higher than the previous 7-day average.", severity: "Medium" },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", serviceId: "hootsuite", title: "Hootsuite reached 90%", severity: "critical", timeLabel: "5 minutes ago", read: false },
  { id: "n2", serviceId: "decodo", title: "Decodo crossed 50%", severity: "warning", timeLabel: "2 hours ago", read: false },
  { id: "n3", serviceId: "zyte", title: "Zyte renewal in 8 days", severity: "info", timeLabel: "Yesterday", read: true },
];

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  thresholds: { t50: true, t75: true, t90: true, t100: true },
  spikeDetection: true,
  spikeSensitivity: "Medium",
  renewalReminders: { d7: true, d3: true, d1: false },
  emailEnabled: true,
  email: "you@example.com",
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailAlerts: true,
  renewalReminders: true,
  spikeAlerts: true,
};

export const PROVIDER_OPTIONS = ["Zyte", "Google", "Hootsuite", "Decodo", "SadCaptcha", "Custom API"] as const;
