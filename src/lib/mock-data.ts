import type { ApiService, AlertSettings, NotificationPrefs } from "./types";

/**
 * Static configuration for the app: which services exist, and defaults for
 * client-side preferences. No fabricated usage data lives here any more.
 */

/**
 * The services we monitor. Identity only — name, provider, colour, how it's
 * billed. Deliberately NO usage/limit/renewal numbers: those must come from the
 * provider or not be shown at all. Seeding them meant a failed fetch left a
 * plausible-looking invented figure on the dashboard.
 */
export const SERVICE_SHELLS: ApiService[] = [
  { id: "zyte", name: "Zyte", provider: "Zyte API", color: "#f97316",
    usage: null, limit: null, unit: "$", renewalDate: "",
    billingCycle: "Monthly", authType: "API Key", lastChecked: "never", fetchState: "loading" },
  { id: "google", name: "YouTube", provider: "YouTube Data API v3", color: "#ff0000",
    usage: null, limit: null, unit: "units", renewalDate: "",
    billingCycle: "Daily", authType: "OAuth", lastChecked: "never", fetchState: "loading" },
  { id: "decodo", name: "Decodo", provider: "Decodo Proxy Network", color: "#0ea5e9",
    usage: null, limit: null, unit: "GB", renewalDate: "",
    billingCycle: "Monthly", authType: "API Key", lastChecked: "never", fetchState: "loading" },
  { id: "sadcaptcha", name: "SadCaptcha", provider: "SadCaptcha API", color: "#a855f7",
    usage: null, limit: null, unit: "credits", renewalDate: "",
    billingCycle: "Custom", authType: "API Key", lastChecked: "never", fetchState: "loading" },
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

export const PROVIDER_OPTIONS = ["Zyte", "Google", "Decodo", "SadCaptcha", "Custom API"] as const;
