"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Segmented } from "@/components/common/segmented";
import { useAppState } from "@/hooks/use-app-state";
import type { AlertSettings, NotificationPrefs } from "@/lib/types";

export function SettingsView() {
  const {
    account, setAccount, notificationPrefs, setNotificationPrefs,
    defaultThresholds, setDefaultThresholds, frequency, setFrequency,
  } = useAppState();
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState(account);

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
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Name</Label>
              <Input id="acc-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-email">Email</Label>
              <Input id="acc-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => { setAccount(draft); toast.success("Account updated."); }}>Save account</Button>
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
