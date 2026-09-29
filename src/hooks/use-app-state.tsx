"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type {
  ApiService, Alert, AlertState, NotificationItem, AlertSettings, NotificationPrefs,
} from "@/lib/types";
import {
  MOCK_SERVICES, MOCK_ALERTS, MOCK_NOTIFICATIONS,
  DEFAULT_ALERT_SETTINGS, DEFAULT_NOTIFICATION_PREFS,
} from "@/lib/mock-data";
import { useLocalStorage } from "./use-local-storage";
import { pct } from "@/lib/format";

interface Account { name: string; email: string }
type Frequency = "15 minutes" | "30 minutes" | "1 hour" | "6 hours";

/**
 * Services dropped from the dashboard. Kept as an explicit list because client
 * state lives in each browser's localStorage: deleting a service from the code
 * does NOT remove it from a returning user's saved copy, so it has to be pruned
 * by id on load. Safe to keep growing; an id that nobody has saved is a no-op.
 */
const RETIRED_SERVICE_IDS = new Set(["hootsuite"]);

/**
 * Services backed by a real provider adapter. `refresh()` must never apply its
 * mock jitter to these — not even when a fetch comes back unusable, because a
 * provider that can't report right now still isn't something we may invent
 * numbers for. Relying on the `live` flag alone was not enough: the moment
 * Decodo started (correctly) reporting "no webhook this cycle", it fell back
 * to `live: false` and silently became eligible for jitter again.
 */
const REAL_PROVIDER_IDS = new Set(["zyte", "decodo", "sadcaptcha", "google"]);

const FREQUENCY_MS: Record<Frequency, number> = {
  "15 minutes": 15 * 60 * 1000,
  "30 minutes": 30 * 60 * 1000,
  "1 hour": 60 * 60 * 1000,
  "6 hours": 6 * 60 * 60 * 1000,
};

interface AppState {
  hydrated: boolean;
  services: ApiService[];
  addService: (s: ApiService) => void;
  alerts: Alert[];
  setAlertState: (id: string, state: AlertState) => void;
  markAllAlertsRead: () => void;
  notifications: NotificationItem[];
  markAllNotificationsRead: () => void;
  unreadNotifications: number;
  alertSettings: Record<string, AlertSettings>;
  getAlertSettings: (id: string) => AlertSettings;
  saveAlertSettings: (id: string, s: AlertSettings) => void;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (p: NotificationPrefs) => void;
  defaultThresholds: AlertSettings["thresholds"];
  setDefaultThresholds: (t: AlertSettings["thresholds"]) => void;
  account: Account;
  setAccount: (a: Account) => void;
  frequency: Frequency;
  setFrequency: (f: Frequency) => void;
  lastUpdated: number;
  refreshing: boolean;
  refresh: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices, hy1] = useLocalStorage<ApiService[]>("apimon.services", MOCK_SERVICES);
  const [alerts, setAlerts, hy2] = useLocalStorage<Alert[]>("apimon.alerts", MOCK_ALERTS);
  const [notifications, setNotifications, hy3] = useLocalStorage<NotificationItem[]>("apimon.notifications", MOCK_NOTIFICATIONS);
  const [alertSettings, setAlertSettings] = useLocalStorage<Record<string, AlertSettings>>("apimon.alertSettings", {});
  const [notificationPrefs, setNotificationPrefs] = useLocalStorage<NotificationPrefs>("apimon.notifPrefs", DEFAULT_NOTIFICATION_PREFS);
  const [defaultThresholds, setDefaultThresholds] = useLocalStorage<AlertSettings["thresholds"]>("apimon.defaultThresholds", DEFAULT_ALERT_SETTINGS.thresholds);
  const [account, setAccount] = useLocalStorage<Account>("apimon.account", { name: "Sudhanshu Agrawal", email: "you@example.com" });
  const [frequency, setFrequency] = useLocalStorage<Frequency>("apimon.frequency", "15 minutes");
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now() - 4 * 60 * 1000);
  const [refreshing, setRefreshing] = useState(false);

  const hydrated = hy1 && hy2 && hy3;

  const addService = useCallback((s: ApiService) => setServices((prev) => [...prev, s]), [setServices]);

  // Once services have hydrated from localStorage, backfill any built-in
  // services that were added to the code AFTER this browser first saved its
  // list (e.g. SadCaptcha) — otherwise a returning user with an older saved
  // array would never see the new default service. Runs once per new default.
  // ...and drop any service we've since stopped tracking. Removing it from
  // MOCK_SERVICES alone isn't enough: a returning browser keeps its own saved
  // copy, so Hootsuite would have stayed on the dashboard forever.
  useEffect(() => {
    if (!hy1) return;
    setServices((prev) => {
      const kept = prev.filter((s) => !RETIRED_SERVICE_IDS.has(s.id));
      const ids = new Set(kept.map((s) => s.id));
      const missing = MOCK_SERVICES.filter((m) => !ids.has(m.id));
      if (kept.length === prev.length && missing.length === 0) return prev;
      return [...kept, ...missing];
    });
  }, [hy1, setServices]);

  // Retired services also leave alerts and notifications behind in localStorage.
  useEffect(() => {
    if (!hy2) return;
    setAlerts((prev) => {
      const kept = prev.filter((a) => !RETIRED_SERVICE_IDS.has(a.serviceId));
      return kept.length === prev.length ? prev : kept;
    });
  }, [hy2, setAlerts]);

  useEffect(() => {
    if (!hy3) return;
    setNotifications((prev) => {
      const kept = prev.filter((n) => !RETIRED_SERVICE_IDS.has(n.serviceId));
      return kept.length === prev.length ? prev : kept;
    });
  }, [hy3, setNotifications]);

/** Pull live numbers for every service with a real provider wired up (Decodo, Zyte, SadCaptcha, YouTube). */
  const fetchLiveData = useCallback(async () => {
    const [decodoRes, zyteRes, sadcaptchaRes, googleRes] = await Promise.allSettled([
      fetch("/api/decodo", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/zyte", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/sadcaptcha", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/google", { cache: "no-store" }).then((r) => r.json()),
    ]);
    const decodo = decodoRes.status === "fulfilled" ? decodoRes.value : null;
    const zyte = zyteRes.status === "fulfilled" ? zyteRes.value : null;
    const sadcaptcha = sadcaptchaRes.status === "fulfilled" ? sadcaptchaRes.value : null;
    const google = googleRes.status === "fulfilled" ? googleRes.value : null;

    setServices((prev) => prev.map((s) => {
      if (s.id === "decodo" && decodo?.configured) {
        if (decodo.ok) {
          return {
            ...s,
            usage: Math.round(decodo.usageGb * 1000) / 1000,
            limit: decodo.limitGb ?? s.limit,
            unit: decodo.mode === "webhook" ? "% of threshold" : s.unit,
            renewalDate: decodo.renewalDate ?? s.renewalDate,
            lastChecked: "just now",
            live: true,
            // even a successful webhook read gets an explanatory note (threshold-only, not continuous)
            liveNote: decodo.mode === "webhook" ? decodo.message : undefined,
            alertMode: decodo.mode === "webhook" ? "fixed-webhook" : undefined,
          };
        }
        // Configured but not reporting (unsupported plan, field not set, no
        // event this cycle) — say so, don't fake it. Crucially the old figure
        // must be CLEARED, not just left alone: a browser that merged last
        // cycle's 80% still has it in localStorage, so simply skipping the
        // write kept a reset plan showing "80 / 100 · High Usage" for days.
        // 0 here means "no threshold crossed yet", which is what Decodo's
        // silence actually tells us — it stays quiet until 80%.
        const webhookMode = decodo.mode === "webhook";
        return {
          ...s,
          usage: webhookMode ? 0 : s.usage,
          limit: webhookMode ? 100 : s.limit,
          unit: webhookMode ? "% of threshold" : s.unit,
          renewalDate: decodo.renewalDate ?? s.renewalDate,
          lastChecked: "just now",
          liveNote: decodo.message ?? "Live fetch failed.",
          // In webhook mode this still counts as live: the integration is
          // connected and Decodo's silence is itself real information (it only
          // speaks at 80%). The badge means "backed by the real provider", not
          // "a number was measured just now" — that nuance is in liveNote.
          live: webhookMode,
          alertMode: webhookMode ? "fixed-webhook" : undefined,
        };
      }
      if (s.id === "zyte" && zyte?.configured) {
        if (zyte.ok) {
          return {
            ...s,
            usage: zyte.usage,
            limit: zyte.limit ?? s.limit,
            unit: "$",
            renewalDate: zyte.renewalDate ?? s.renewalDate,
            lastChecked: "just now",
            live: true,
            // Real measured days from Zyte's stats API — the chart stops guessing.
            dailyUsage: Array.isArray(zyte.history)
              ? zyte.history.map((d: { date: string; usd: number }) => ({ date: d.date, value: d.usd }))
              : undefined,
            liveNote: zyte.limit == null
              ? "No ZYTE_LIMIT set — this account has no Spending Limit configured on Zyte's own Spending Alerts page either, so this % is against a placeholder, not a real cap."
              : undefined,
          };
        }
        return { ...s, renewalDate: zyte.renewalDate ?? s.renewalDate, liveNote: zyte.message ?? "Live fetch failed.", live: false };
      }
      if (s.id === "sadcaptcha" && sadcaptcha?.configured) {
        if (sadcaptcha.ok) {
          const hasTotal = sadcaptcha.usage != null && sadcaptcha.limit != null;
          // With a known total: usage = consumed, limit = total => real % used.
          // Without it: we only know credits remaining. Show usage=0 so the bar
          // stays green (not a misleading red 100%), put the real remaining in
          // the Remaining column (limit - usage), and let the note explain that
          // a true % needs SADCAPTCHA_TOTAL_CREDITS.
          return {
            ...s,
            usage: hasTotal ? sadcaptcha.usage : 0,
            limit: hasTotal ? sadcaptcha.limit : sadcaptcha.remaining,
            unit: "credits",
            lastChecked: "just now",
            live: true,
            liveNote: hasTotal ? undefined : sadcaptcha.message,
            alertMode: "low-balance",
          };
        }
        return { ...s, liveNote: sadcaptcha.message ?? "Live fetch failed.", live: false, alertMode: "low-balance" };
      }
      if (s.id === "google" && google?.configured) {
        // PARKED (2026-09-28). The fetch itself works now that billing is
        // active, but the metric is wrong — it reported 5,156,540 "units"
        // against a 10,000/day cap. Deliberately NOT marked `live` and the
        // number is NOT merged in: a green "Live data" badge over a wrong
        // figure is worse than no figure, because it looks trustworthy.
        // Also reset to the placeholder: a browser that merged the bad figure
        // before this change still has it in localStorage, and simply not
        // overwriting it would leave the wrong number on screen forever.
        const seed = MOCK_SERVICES.find((m) => m.id === "google");
        return {
          ...s,
          usage: seed?.usage ?? s.usage,
          limit: seed?.limit ?? s.limit,
          live: false,
          liveNote: google.ok
            ? "Paused — the Cloud Monitoring metric returns a figure far larger than the daily quota, so it isn't trustworthy yet. Showing the placeholder instead."
            : google.message ?? "Live fetch failed.",
        };
      }
      if (s.id === "google" && google?.configured) {
        if (google.ok) {
          return {
            ...s,
            usage: google.usage,
            limit: google.limit ?? s.limit,
            unit: google.unit ?? "units",
            lastChecked: "just now",
            live: true,
            liveNote: google.limit == null
              ? "Couldn't auto-detect the daily quota limit — % is against a placeholder."
              : undefined,
          };
        }
        return { ...s, liveNote: google.message ?? "Live fetch failed.", live: false };
      }
      return s;
    }));
    setLastUpdated(Date.now());
  }, [setServices]);

  const pathname = usePathname();
  const lastAutoFetchAt = useRef(0);
  const MIN_AUTO_FETCH_GAP_MS = 20_000; // avoid hammering rate-limited APIs (e.g. Zyte: 20 req/min) if you navigate quickly

  // Re-check live data whenever the user lands on a new page — the layout
  // (and this provider) stays mounted across client-side navigation, so
  // without this, live numbers only ever reflected the very first page load.
  // Throttled: only the manual Refresh button (fetchLiveData called directly
  // from `refresh`) is guaranteed to run immediately every time.
  useEffect(() => {
    const now = Date.now();
    if (now - lastAutoFetchAt.current < MIN_AUTO_FETCH_GAP_MS) return;
    lastAutoFetchAt.current = now;
    fetchLiveData();
  }, [fetchLiveData, pathname]);

  // Background polling on the interval chosen in Settings -> Monitoring,
  // so the dashboard updates even if you just leave a tab open.
  useEffect(() => {
    const ms = FREQUENCY_MS[frequency] ?? FREQUENCY_MS["15 minutes"];
    const id = setInterval(fetchLiveData, ms);
    return () => clearInterval(id);
  }, [frequency, fetchLiveData]);

  const setAlertState = useCallback((id: string, state: AlertState) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, state } : a))), [setAlerts]);

  const markAllAlertsRead = useCallback(() =>
    setAlerts((prev) => prev.map((a) => (a.state === "unread" ? { ...a, state: "read" } : a))), [setAlerts]);

  const markAllNotificationsRead = useCallback(() =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), [setNotifications]);

  const getAlertSettings = useCallback((id: string): AlertSettings =>
    alertSettings[id] ?? { ...DEFAULT_ALERT_SETTINGS, thresholds: defaultThresholds, email: account.email },
    [alertSettings, defaultThresholds, account.email]);

  const saveAlertSettings = useCallback((id: string, s: AlertSettings) =>
    setAlertSettings((prev) => ({ ...prev, [id]: s })), [setAlertSettings]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(async () => {
      setServices((prev) => prev.map((s) => {
        if (s.live || REAL_PROVIDER_IDS.has(s.id)) return s; // real providers get real data below, never mock jitter
        const jitter = Math.max(-4, Math.min(4, Math.round((Math.random() - 0.4) * 5)));
        const p = Math.max(2, Math.min(100, pct(s.usage, s.limit) + jitter));
        return { ...s, usage: Math.round((p / 100) * s.limit), lastChecked: "just now" };
      }));
      await fetchLiveData();
      setLastUpdated(Date.now());
      setRefreshing(false);
    }, 750);
  }, [setServices, fetchLiveData]);

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: AppState = {
    hydrated, services, addService, alerts, setAlertState, markAllAlertsRead,
    notifications, markAllNotificationsRead, unreadNotifications,
    alertSettings, getAlertSettings, saveAlertSettings,
    notificationPrefs, setNotificationPrefs, defaultThresholds, setDefaultThresholds,
    account, setAccount, frequency, setFrequency, lastUpdated, refreshing, refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
