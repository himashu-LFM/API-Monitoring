import "server-only";
import { otelTotalUsd } from "@/lib/otel/store";

/**
 * Real Anthropic (Claude API) spend, via the Admin Cost Report API.
 * Server-side only — the Admin key must never reach the browser.
 *
 * Confirmed from https://platform.claude.com/docs/en/manage-claude/usage-cost-api
 * (2026-10):
 *   GET https://api.anthropic.com/v1/organizations/cost_report
 *     ?starting_at=<ISO>&ending_at=<ISO>
 *   headers: x-api-key: <ADMIN_KEY>, anthropic-version: 2023-06-01
 *   -> { data: [{ results: [{ currency:"USD", amount, ... }] }], has_more, next_page }
 *   Amounts are USD in the LOWEST unit (cents) as decimal STRINGS — divide by 100.
 *   Daily granularity only; paginate via `page` while has_more is true.
 *
 * ⚠️ Requires an ADMIN API key (`sk-ant-admin01-...`), NOT a regular API key.
 * Only an org admin can create one in the Claude Console; a normal key is rejected.
 *
 * Anthropic credits are a PREPAID TOP-UP — no renewal, no billing cycle. They
 * just deplete until spent. So:
 *   usage = cumulative USD spent since ANTHROPIC_START (the day you topped up)
 *   limit = ANTHROPIC_LIMIT (the top-up amount in USD)
 *   remaining = limit - usage
 */

const BASE = "https://api.anthropic.com/v1/organizations/cost_report";

export interface AnthropicUsageResult {
  ok: boolean;
  configured: boolean;
  usage?: number; // USD spent since the top-up date
  limit?: number; // USD topped up (ANTHROPIC_LIMIT)
  message?: string;
}

function startOfMonthUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function fetchAnthropicUsage(): Promise<AnthropicUsageResult> {
  const limit = process.env.ANTHROPIC_LIMIT?.trim() ? Number(process.env.ANTHROPIC_LIMIT) : undefined;

  // ── Manual mode ──────────────────────────────────────────────
  // The Admin Cost API is unavailable on individual accounts (and needs admin
  // permissions that a plain org-scoped key doesn't have). When you can't use
  // it, set ANTHROPIC_USED to the spend you read off the Console Cost page and
  // we show that instead — no key needed. Takes precedence when present.
  const usedManual = process.env.ANTHROPIC_USED?.trim();
  if (usedManual) {
    const usage = Number(usedManual);
    if (!Number.isFinite(usage)) {
      return { ok: false, configured: true, limit, message: "ANTHROPIC_USED must be a number (USD spent so far)." };
    }
    return { ok: true, configured: true, usage, limit, message: "Manual value — update ANTHROPIC_USED from the Console Cost page when you top up or check in." };
  }

  // ── Exact mode: Admin Cost API (team/org accounts) ───────────
  // Try it if a key is set; on success it's bill-exact. On a permission error
  // (individual orgs always 403) we fall through to the OTel estimate below, so
  // this upgrades automatically if the org is ever converted to a team.
  const key = process.env.ANTHROPIC_ADMIN_KEY?.trim();
  if (key) {
    const exact = await tryCostApi(key);
    if (exact !== null) {
      const message = !process.env.ANTHROPIC_START?.trim()
        ? "Counting spend from the 1st of this month (set ANTHROPIC_START to your top-up date for the true balance)."
        : undefined;
      return { ok: true, configured: true, usage: exact, limit, message };
    }
    // else: key can't read cost (individual org) — use OTel below.
  }

  // ── Estimate mode: OpenTelemetry token totals ────────────────
  // Anthropic pushes a span per request to /api/otel; we price the tokens. Set
  // ANTHROPIC_LIMIT to your Console credit balance when the destination went
  // live, and "used" = estimated spend since then.
  const otel = await otelTotalUsd();
  if (otel) {
    return {
      ok: true, configured: true, usage: otel.usd, limit,
      message: `Estimated from OpenTelemetry (${otel.spanCount} requests since go-live) — not bill-exact. Reconcile with the Console Cost page periodically.`,
    };
  }

  // Configured (LIMIT set) but no data yet: OTel destination not live, or no
  // requests since it went live.
  if (limit != null || key) {
    return { ok: false, configured: true, limit, message: "Waiting for OpenTelemetry data — add the destination in the Console (and ensure OTEL_INGEST_SECRET matches), or set ANTHROPIC_USED for a manual value." };
  }
  return { ok: false, configured: false, message: "Set ANTHROPIC_USED (manual) or ANTHROPIC_LIMIT + the OpenTelemetry destination in .env.local / Console." };
}

/** Admin Cost API. Returns USD spent, or null if the key can't read cost. */
async function tryCostApi(key: string): Promise<number | null> {
  const startDate = process.env.ANTHROPIC_START?.trim() || startOfMonthUtc();
  const start = new Date(startDate + "T00:00:00Z").toISOString();
  const end = new Date().toISOString();
  try {
    let totalCents = 0;
    let page: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const url = new URL(BASE);
      url.searchParams.set("starting_at", start);
      url.searchParams.set("ending_at", end);
      if (page) url.searchParams.set("page", page);
      const res = await fetch(url, {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        cache: "no-store",
      });
      if (!res.ok) return null; // 401/403/etc → fall back to OTel estimate
      const data = await res.json();
      for (const bucket of data?.data ?? []) {
        for (const r of bucket?.results ?? []) {
          const cents = Number(r?.amount);
          if (Number.isFinite(cents)) totalCents += cents;
        }
      }
      if (!data?.has_more || !data?.next_page) break;
      page = data.next_page;
    }
    return Math.round(totalCents) / 100;
  } catch {
    return null;
  }
}
