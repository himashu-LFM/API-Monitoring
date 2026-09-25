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
  useEffect(() => {
    if (!hy1) return;
    setServices((prev) => {
      const ids = new Set(prev.map((s) => s.id));
      const missing = MOCK_SERVICES.filter((m) => !ids.has(m.id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [hy1, setServices]);

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
            thresholdOnly: decodo.mode === "webhook",
          };
        }
        // Configured but not fully working yet (unsupported plan, field not set, no event yet) — say so, don't fake it.
        return {
          ...s,
          renewalDate: decodo.renewalDate ?? s.renewalDate,
          liveNote: decodo.message ?? "Live fetch failed.",
          live: false,
          thresholdOnly: decodo.mode === "webhook",
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
          };
        }
        return { ...s, liveNote: sadcaptcha.message ?? "Live fetch failed.", live: false };
      }
      if (s.id === "google" && google?.configured) {
        if (google.ok) {
          return {
            ...s,
            usage: google.usage,
            limit: google.limit ?? s.limit,
            unit: "units",
            lastChecked: "just now",
            live: true,
            liveNote: "YouTube quota resets daily at midnight Pacific.",
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
        if (s.live) return s; // live services get real data below, not mock jitter
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
