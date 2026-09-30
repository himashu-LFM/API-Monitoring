"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type {
  ApiService, Alert, AlertState, NotificationItem, AlertSettings, NotificationPrefs,
} from "@/lib/types";
import {
  SERVICE_SHELLS,
  DEFAULT_ALERT_SETTINGS, DEFAULT_NOTIFICATION_PREFS,
} from "@/lib/mock-data";
import { useLocalStorage } from "./use-local-storage";

interface Account { name: string; email: string }
type Frequency = "15 minutes" | "30 minutes" | "1 hour" | "6 hours";

/**
 * Services dropped from the dashboard. Kept as an explicit list because client
 * state lives in each browser's localStorage: deleting a service from the code
 * does NOT remove it from a returning user's saved copy, so it has to be pruned
 * by id on load. Safe to keep growing; an id that nobody has saved is a no-op.
 */
const RETIRED_SERVICE_IDS = new Set(["hootsuite"]);

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
  const [services, setServices, hy1] = useLocalStorage<ApiService[]>("apimon.services.v2", SERVICE_SHELLS);
  const [alerts, setAlerts, hy2] = useLocalStorage<Alert[]>("apimon.alerts", []);
  const [notifications, setNotifications, hy3] = useLocalStorage<NotificationItem[]>("apimon.notifications", []);
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
  // SERVICE_SHELLS alone isn't enough: a returning browser keeps its own saved
  // copy, so Hootsuite would have stayed on the dashboard forever.
  useEffect(() => {
    if (!hy1) return;
    setServices((prev) => {
      const kept = prev.filter((s) => !RETIRED_SERVICE_IDS.has(s.id));
      const ids = new Set(kept.map((s) => s.id));
      const missing = SERVICE_SHELLS.filter((m) => !ids.has(m.id));
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

/**
 * Pull live numbers for every service with a real provider wired up.
 *
 * Each provider is merged the moment ITS OWN response lands, rather than
 * waiting for all four. Zyte's stats API takes 7-11s (measured; it is slow
 * regardless of window size or grouping), and batching meant Decodo (~0ms,
 * local file), SadCaptcha (~0.4s) and Google (~1.2s) all sat invisible behind
 * it — the whole dashboard looked frozen for ten seconds because of one
 * upstream. Now the fast ones paint immediately and Zyte fills in late.
 */
  const fetchLiveData = useCallback(async () => {
    const patch = (id: string, fn: (s: ApiService) => ApiService) =>
      setServices((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));

    const get = (path: string) => fetch(path, { cache: "no-store" }).then((r) => r.json());

    const decodoJob = get("/api/decodo").then((decodo) => {
      if (!decodo?.configured) {
        // Not configured is a final answer, not a pending one — otherwise the
        // card spins forever waiting for a provider that will never report.
        patch("decodo", (s) => ({ ...s, live: false, fetchState: "failed" as const,
          liveNote: decodo?.message ?? "Not configured — add its keys to .env.local." }));
        return;
      }
      patch("decodo", (s) => {
        const webhookMode = decodo.mode === "webhook";
        if (decodo.ok) {
          return {
            ...s,
            usage: Math.round(decodo.usageGb * 1000) / 1000,
            limit: decodo.limitGb ?? s.limit,
            unit: webhookMode ? "% of threshold" : s.unit,
            renewalDate: decodo.renewalDate ?? s.renewalDate,
            lastChecked: "just now",
            live: true,
            fetchState: "live" as const,
            // even a successful webhook read gets an explanatory note (threshold-only, not continuous)
            liveNote: webhookMode ? decodo.message : undefined,
            alertMode: webhookMode ? "fixed-webhook" : undefined,
          };
        }
        // No webhook for the CURRENT cycle, so there is no number to show.
        //
        // Everything here used to be inferred rather than reported: a 0 because
        // "Decodo stays quiet under 80%", against a hardcoded 100. Both were our
        // reasoning, not Decodo's data, and a stored event from a finished cycle
        // was enough to keep the LIVE badge on. This service is webhook-only, so
        // it now shows a figure ONLY when a webhook for this cycle delivered one.
        //
        // `webhookSeen` still shapes the explanation below — "never connected"
        // and "connected but quiet" are genuinely different problems — but it no
        // longer puts a number on screen.
        //
        // Clearing the old values matters: a browser that merged last cycle's
        // 80% still has it in localStorage, so skipping the write would leave a
        // reset plan showing "80 / 100 · High Usage" for days.
        return {
          ...s,
          usage: webhookMode ? null : s.usage,
          limit: webhookMode ? null : s.limit,
          unit: webhookMode ? "% of threshold" : s.unit,
          renewalDate: decodo.renewalDate ?? s.renewalDate,
          lastChecked: "just now",
          liveNote: decodo.message ?? "Live fetch failed.",
          // Silence is the designed behaviour in webhook mode, not a failure:
          // Decodo sends nothing between its 80% and 100% points. Marking it
          // "failed" painted a working integration red and offered a Retry that
          // could never produce data. Only the REST path (which should answer
          // every call) is a genuine failure when it doesn't.
          fetchState: webhookMode ? ("waiting" as const) : ("failed" as const),
          live: false,
          alertMode: webhookMode ? "fixed-webhook" : undefined,
        };
      });
    });

    const zyteJob = get("/api/zyte").then((zyte) => {
      if (!zyte?.configured) {
        // Not configured is a final answer, not a pending one — otherwise the
        // card spins forever waiting for a provider that will never report.
        patch("zyte", (s) => ({ ...s, live: false, fetchState: "failed" as const,
          liveNote: zyte?.message ?? "Not configured — add its keys to .env.local." }));
        return;
      }
      patch("zyte", (s) => {
        if (!zyte.ok) {
          return { ...s, renewalDate: zyte.renewalDate ?? s.renewalDate, liveNote: zyte.message ?? "Live fetch failed.", live: false, fetchState: "failed" as const };
        }
        return {
          ...s,
          usage: zyte.usage,
          limit: zyte.limit ?? s.limit,
          unit: "$",
          renewalDate: zyte.renewalDate ?? s.renewalDate,
          lastChecked: "just now",
          live: true,
          fetchState: "live" as const,
          // Real measured days from Zyte's stats API — the chart stops guessing.
          dailyUsage: Array.isArray(zyte.history)
            ? zyte.history.map((d: { date: string; usd: number }) => ({ date: d.date, value: d.usd }))
            : undefined,
          liveNote: zyte.limit == null
            ? "No ZYTE_LIMIT set — this account has no Spending Limit configured on Zyte's own Spending Alerts page either, so this % is against a placeholder, not a real cap."
            : undefined,
        };
      });
    });

    const sadcaptchaJob = get("/api/sadcaptcha").then((sadcaptcha) => {
      if (!sadcaptcha?.configured) {
        // Not configured is a final answer, not a pending one — otherwise the
        // card spins forever waiting for a provider that will never report.
        patch("sadcaptcha", (s) => ({ ...s, live: false, fetchState: "failed" as const,
          liveNote: sadcaptcha?.message ?? "Not configured — add its keys to .env.local." }));
        return;
      }
      patch("sadcaptcha", (s) => {
        if (!sadcaptcha.ok) {
          return { ...s, liveNote: sadcaptcha.message ?? "Live fetch failed.", live: false, alertMode: "low-balance" as const, fetchState: "failed" as const };
        }
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
          fetchState: "live" as const,
          liveNote: hasTotal ? undefined : sadcaptcha.message,
          alertMode: "low-balance",
        };
      });
    });

    const googleJob = get("/api/google").then((google) => {
      if (!google?.configured) {
        // Not configured is a final answer, not a pending one — otherwise the
        // card spins forever waiting for a provider that will never report.
        patch("google", (s) => ({ ...s, live: false, fetchState: "failed" as const,
          liveNote: google?.message ?? "Not configured — add its keys to .env.local." }));
        return;
      }
      patch("google", (s) => {
        if (!google.ok) {
          return { ...s, liveNote: google.message ?? "Live fetch failed.", live: false, fetchState: "failed" as const };
        }
        return {
          ...s,
          usage: google.usage,
          limit: google.limit ?? s.limit,
          unit: google.unit ?? "units",
          lastChecked: "just now",
          live: true,
          fetchState: "live" as const,
          liveNote: google.limit == null
            ? "Couldn't auto-detect the daily quota limit — % is against a placeholder."
            : undefined,
        };
      });
    });

    await Promise.allSettled([decodoJob, zyteJob, sadcaptchaJob, googleJob]);
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

  // Starts fetching immediately. There used to be a 750ms setTimeout here, left
  // from when every service was mock and the delay made Refresh feel like it was
  // doing work; with real providers it was just 750ms of nothing before the
  // requests even left. The mock-jitter pass it wrapped is gone too — every
  // remaining service is backed by a real provider, so it could never fire.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchLiveData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchLiveData]);

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
