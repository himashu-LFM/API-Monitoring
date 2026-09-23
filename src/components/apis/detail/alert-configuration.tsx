"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAppState } from "@/hooks/use-app-state";
import type { AlertSettings } from "@/lib/types";

export function AlertConfiguration({ serviceId }: { serviceId: string }) {
  const { getAlertSettings, saveAlertSettings } = useAppState();
  const [settings, setSettings] = useState<AlertSettings>(() => getAlertSettings(serviceId));

  const set = (patch: Partial<AlertSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const save = () => {
    saveAlertSettings(serviceId, settings);
    toast.success("Alert settings updated.");
  };

  const thresholdKeys: [keyof AlertSettings["thresholds"], string][] = [
    ["t50", "50%"], ["t75", "75%"], ["t90", "90%"], ["t100", "100%"],
  ];
  const reminderKeys: [keyof AlertSettings["renewalReminders"], string][] = [
    ["d7", "7 days before"], ["d3", "3 days before"], ["d1", "1 day before"],
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Alert configuration</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">Usage thresholds</legend>
          <div className="grid grid-cols-2 gap-2">
            {thresholdKeys.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={settings.thresholds[k]} onCheckedChange={(v) => set({ thresholds: { ...settings.thresholds, [k]: !!v } })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Separator />

        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground">Usage spike detection</div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={settings.spikeDetection} onCheckedChange={(v) => set({ spikeDetection: !!v })} />
            Enable usage spike alerts
          </label>
          <div className="space-y-1.5">
            <Label>Spike sensitivity</Label>
            <Select value={settings.spikeSensitivity} onValueChange={(v) => v && set({ spikeSensitivity: v as AlertSettings["spikeSensitivity"] })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{["Low", "Medium", "High"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">Renewal reminders</legend>
          <div className="space-y-2">
            {reminderKeys.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={settings.renewalReminders[k]} onCheckedChange={(v) => set({ renewalReminders: { ...settings.renewalReminders, [k]: !!v } })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Email notifications</span>
            <Switch checked={settings.emailEnabled} onCheckedChange={(v) => set({ emailEnabled: v })} aria-label="Email notifications" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`email-${serviceId}`}>Email</Label>
            <Input id={`email-${serviceId}`} type="email" value={settings.email} onChange={(e) => set({ email: e.target.value })} />
            <p className="text-xs text-muted-foreground">Example address — mock data only.</p>
          </div>
        </div>

        <Button className="w-full" onClick={save}>Save changes</Button>
      </CardContent>
    </Card>
  );
}
