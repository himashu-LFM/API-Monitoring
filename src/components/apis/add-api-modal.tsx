"use client";

import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/hooks/use-app-state";
import type { ApiService, BillingCycle, AuthType } from "@/lib/types";

const schema = z.object({
  provider: z.string().min(1, "Select a provider"),
  name: z.string().min(2, "Enter a service name"),
  authType: z.enum(["API Key", "Bearer Token", "OAuth", "Custom"]),
  credential: z.string().min(1, "Enter a credential"),
  limit: z.coerce.number().int().positive("Enter a usage limit"),
  billingCycle: z.enum(["Daily", "Weekly", "Monthly", "Annual", "Custom"]),
  renewalDate: z.string().min(1, "Pick a renewal date"),
});
type FormValues = z.input<typeof schema>;

const PROVIDERS = ["Zyte", "Google", "Decodo", "Custom API"];
const COLORS: Record<string, string> = { Zyte: "#f97316", Google: "#4285f4", Decodo: "#0ea5e9" };

export function AddApiModal({ trigger }: { trigger: ReactElement }) {
  const { addService } = useAppState();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: "Zyte", name: "", authType: "API Key", credential: "",
      limit: 100000, billingCycle: "Monthly", renewalDate: "2026-10-31",
    },
  });

  const testConnection = () => {
    setTesting(true); setTested(false);
    setTimeout(() => { setTesting(false); setTested(true); }, 1100);
  };

  const onSubmit = (v: FormValues) => {
    const parsed = schema.parse(v);
    const service: ApiService = {
      id: `${parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
      name: parsed.name,
      provider: parsed.provider === "Custom API" ? "Custom API" : parsed.provider,
      color: COLORS[parsed.provider] ?? "#6366f1",
      usage: 0,
      limit: parsed.limit,
      unit: "requests",
      renewalDate: parsed.renewalDate,
      billingCycle: parsed.billingCycle as BillingCycle,
      authType: parsed.authType as AuthType,
      lastChecked: "just now",
    };
    addService(service);
    setOpen(false);
    setTested(false);
    form.reset();
    toast.success("API added to monitoring.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTested(false); }}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-5">
          <DialogTitle>Add API</DialogTitle>
          <DialogDescription>Connect a service to monitor. Credentials are stored securely and never shown in full (mock).</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 p-5">
            <Field label="Service provider" error={form.formState.errors.provider?.message}>
              <Select defaultValue={form.getValues("provider")} onValueChange={(v) => v && form.setValue("provider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <Field label="Service name" error={form.formState.errors.name?.message}>
              <Input placeholder="e.g. Zyte — Production" {...form.register("name")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Authentication" error={form.formState.errors.authType?.message}>
                <Select defaultValue={form.getValues("authType")} onValueChange={(v) => v && form.setValue("authType", v as AuthType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["API Key", "Bearer Token", "OAuth", "Custom"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Credential" error={form.formState.errors.credential?.message}>
                <Input type="password" placeholder="••••••••••••" {...form.register("credential")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Usage limit" error={form.formState.errors.limit?.message}>
                <Input type="number" {...form.register("limit")} />
              </Field>
              <Field label="Billing cycle" error={form.formState.errors.billingCycle?.message}>
                <Select defaultValue={form.getValues("billingCycle")} onValueChange={(v) => v && form.setValue("billingCycle", v as BillingCycle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Daily", "Weekly", "Monthly", "Annual", "Custom"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Renewal / reset date" error={form.formState.errors.renewalDate?.message}>
              <Input type="date" {...form.register("renewalDate")} />
            </Field>

            <Separator />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">Alert thresholds</legend>
              <div className="flex flex-wrap gap-4">
                {["50%", "75%", "90%", "100%", "Usage spike"].map((t, i) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox defaultChecked={i < 4} /> {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">Renewal reminders</legend>
              <div className="flex flex-wrap gap-4">
                {["7 days", "3 days", "1 day"].map((t, i) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox defaultChecked={i < 2} /> {t}
                  </label>
                ))}
              </div>
            </fieldset>

            {tested && (
              <p className="flex items-center gap-2 text-sm font-medium text-ok">
                <CheckCircle2 className="size-4" /> Connection successful
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 border-t p-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="outline" onClick={testConnection} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button type="submit">Save API</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-crit">{error}</p>}
    </div>
  );
}
