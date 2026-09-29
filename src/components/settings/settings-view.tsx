"use client";

import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/common/segmented";
import { useAppState } from "@/hooks/use-app-state";
import { initialsFrom } from "@/lib/user-display";
import type { AlertSettings, NotificationPrefs } from "@/lib/types";

export function SettingsView() {
  const {
    notificationPrefs, setNotificationPrefs,
    defaultThresholds, setDefaultThresholds, frequency, setFrequency,
  } = useAppState();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const name = session?.user?.name ?? "—";
  const email = session?.user?.email ?? "—";
  const role = session?.user?.role === "ADMIN" ? "Admin" : "Member";

  const notifRows: [keyof NotificationPrefs, string, string][] = [
    ["emailAlerts", "Email alerts", "Threshold breach notifications by email"],
    ["renewalReminders", "Renewal reminders", "Upcoming billing cycle resets"],
    ["spikeAlerts", "Usage spike alerts", "Anomaly detection notices"],
  ];
  const thresholdKeys: [keyof AlertSettings["thresholds"], string][] = [
    ["t50", "50%"], ["t75", "75%"], ["t90", "90%"], ["t100", "100%"],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-base font-semibold text-white">
              {initialsFrom(session?.user?.name, session?.user?.email)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{name}</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{role}</span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Your name and email come from your Google account and can&apos;t be edited here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {notifRows.map(([k, title, desc]) => (
            <div key={k} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={notificationPrefs[k]} onCheckedChange={(v) => setNotificationPrefs({ ...notificationPrefs, [k]: v })} aria-label={title} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Default alert thresholds</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-5">
          {thresholdKeys.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox checked={defaultThresholds[k]} onCheckedChange={(v) => setDefaultThresholds({ ...defaultThresholds, [k]: !!v })} />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Monitoring</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Label>Monitoring frequency</Label>
          <Select value={frequency} onValueChange={(v) => v && setFrequency(v as typeof frequency)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["15 minutes", "30 minutes", "1 hour", "6 hours"].map((f) => <SelectItem key={f} value={f}>Every {f}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">UI configuration only in this prototype.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Theme</div>
            <div className="text-xs text-muted-foreground">Light and dark are both fully supported.</div>
          </div>
          <Segmented
            options={[{ label: "Light", value: "light" }, { label: "Dark", value: "dark" }]}
            value={(theme === "dark" ? "dark" : "light") as "light" | "dark"}
            onChange={(v) => setTheme(v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-info/10 text-info"><Lock className="size-4" /></span>
            <div>
              <div className="text-sm font-medium">Credentials are encrypted</div>
              <p className="mt-0.5 text-sm text-muted-foreground">API credentials are encrypted and never displayed in full. Product concept — not yet implemented.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
