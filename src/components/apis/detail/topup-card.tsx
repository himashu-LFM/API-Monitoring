"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/hooks/use-app-state";

/**
 * Change a Zyte limit or a Decodo renewal date without touching env vars or
 * redeploying. Saved server-side (POST /api/topups) and applied on the next fetch.
 */
const FIELDS: Record<string, { key: string; title: string; label: string; hint: string; type: "number" | "date"; placeholder?: string }> = {
  zyte: {
    key: "limit",
    title: "Change Zyte spending limit",
    label: "New spending limit (USD)",
    hint: "The full limit after the top-up, as set in the Zyte dashboard. Alerts re-arm against it.",
    type: "number",
    placeholder: "e.g. 6500",
  },
  decodo: {
    key: "renewal",
    title: "Change Decodo renewal date",
    label: "Renewal date",
    hint: "Any renewal date of the plan (past or next). It rolls forward each cycle on its own.",
    type: "date",
  },
};

export function TopupCard({ serviceId }: { serviceId: string }) {
  const { refresh } = useAppState();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const field = FIELDS[serviceId];
  if (!field) return null;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/topups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: serviceId, [field.key]: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: res.status === 403 ? "Only admins can change this." : data?.error ?? `Save failed (HTTP ${res.status})` });
        return;
      }
      setValue("");
      setMsg({ ok: true, text: "Saved — dashboard updated. No redeploy needed." });
      refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{field.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); if (value.trim()) save(); }}
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">{field.label}</span>
            <Input
              type={field.type === "date" ? "date" : "text"}
              inputMode={field.type === "number" ? "decimal" : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field.placeholder}
              aria-label={field.label}
            />
          </label>
          <Button type="submit" disabled={saving || !value.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{field.hint}</p>
        {msg && <p className={`text-xs font-medium ${msg.ok ? "text-ok" : "text-crit"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
