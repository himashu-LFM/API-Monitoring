"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  /** Pull live numbers for any service with a real provider wired up (currently: Decodo). */
  const fetchLiveData = useCallback(async () => {
    try {
      const res = await fetch("/api/decodo", { cache: "no-store" });
      const data = await res.json();
      if (!data.configured) return; // no key set — keep showing mock data untouched

      setServices((prev) => prev.map((s) => {
        if (s.id !== "decodo") return s;
        if (data.ok) {
          return {
            ...s,
            usage: Math.round(data.usageGb * 1000) / 1000,
            limit: data.limitGb ?? s.limit,
            unit: data.mode === "webhook" ? "% of threshold" : s.unit,
            renewalDate: data.renewalDate ?? s.renewalDate,
            lastChecked: "just now",
            live: true,
            // even a successful webhook read gets an explanatory note (threshold-only, not continuous)
            liveNote: data.mode === "webhook" ? data.message : undefined,
          };
        }
        // Configured but not fully working yet (unsupported plan, field not set, no event yet) — say so, don't fake it.
        return { ...s, renewalDate: data.renewalDate ?? s.renewalDate, liveNote: data.message ?? "Live fetch failed.", live: false };
      }));
    } catch {
      // Network/route error — leave the service as-is (mock or last-known-live).
    }
  }, [setServices]);

  useEffect(() => { fetchLiveData(); }, [fetchLiveData]);

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
