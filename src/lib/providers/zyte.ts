import "server-only";
import { nextRenewalOnOrAfter, currentPeriodStart } from "@/lib/format";

/**
 * Real Zyte integration (server-side only — the API key must stay off
 * the browser). Confirmed from https://docs.zyte.com/zyte-api/usage/stats.html
 * (2026-09), full documented schema — no guessing needed here:
 *
 *   GET https://zyte-api-stats.zyte.com/api/stats
 *     ?organization_id=<id>&start_time=<ISO>&end_time=<ISO>
 *   -> {
 *        page, page_size, total_result_count,
 *        results: [{
 *          organization_id, request_count, billed_traffic_bytes,
 *          cost_microusd_avg, cost_microusd_p80, cost_microusd_total,
 *          response_time_sec_avg, response_time_sec_p80,
 *          status_codes: [{ code, count }]
 *        }]
 *      }
 *   With no groupby_* params, `results` is a single row summarizing the
 *   whole date range — `request_count` is the usage number we want.
 *
 * Auth: HTTP Basic, username = your Zyte *dashboard/stats* API key
 * (docs are explicit that this is NOT the same as the Zyte API key you
 * use for scraping requests), empty password.
 *
 * Zyte plans cap USD SPEND, not request count (confirmed via
 * zyte.com/blog/new-spending-controls-and-usage-insights-for-zyte-api
 * and this account's own Spending Alerts page, which had no limit set —
 * that page is a self-serve email/pause alert, not a value the API
 * exposes). So the tracked metric here is `cost_microusd_total`
 * (micro-USD -> USD), matched against ZYTE_LIMIT read as a dollar
 * figure, not a request count.
 */

const BASE = "https://zyte-api-stats.zyte.com";

export interface ZyteUsageResult {
  ok: boolean;
  configured: boolean;
  usage?: number; // USD spent over the window
  limit?: number; // USD budget (yours, or your Zyte Spending Alert amount)
  renewalDate?: string;
  message?: string;
}

export async function fetchZyteUsage(): Promise<ZyteUsageResult> {
  const apiKey = process.env.ZYTE_API_KEY?.trim();
  const orgId = process.env.ZYTE_ORG_ID?.trim();
  if (!apiKey) return { ok: false, configured: false, message: "Set ZYTE_API_KEY (dashboard/stats API key, not the scraping API key) in .env.local" };
  if (!orgId) return { ok: false, configured: false, message: "Set ZYTE_ORG_ID in .env.local" };

  const limit = process.env.ZYTE_LIMIT?.trim() ? Number(process.env.ZYTE_LIMIT) : undefined;
  const anchor = process.env.ZYTE_RENEWAL?.trim();
  const cycle = process.env.ZYTE_BILLING_CYCLE?.trim() || "Monthly";
  const renewalDate = anchor ? nextRenewalOnOrAfter(anchor, cycle) : undefined;

  const end = new Date();
  // Prefer "since this billing cycle started" over a fixed rolling window —
  // a plain last-30-days window bleeds into the previous cycle whenever the
  // cycle just started (e.g. only 13 days into a 30-day month).
  const start = anchor
    ? new Date(currentPeriodStart(anchor, cycle) + "T00:00:00Z")
    : new Date(end.getTime() - 30 * 86400000);

  const auth = "Basic " + Buffer.from(apiKey + ":").toString("base64");
  const url = `${BASE}/api/stats?organization_id=${encodeURIComponent(orgId)}`
    + `&start_time=${encodeURIComponent(start.toISOString())}`
    + `&end_time=${encodeURIComponent(end.toISOString())}`;

  try {
    const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
    if (res.status === 429) {
      return { ok: false, configured: true, limit, renewalDate, message: "Zyte stats API rate limit hit (20 req/min) — try again shortly." };
    }
    if (!res.ok) {
      return { ok: false, configured: true, limit, renewalDate, message: `Zyte stats API returned HTTP ${res.status}` };
    }
    const data = await res.json();
    const row = Array.isArray(data?.results) ? data.results[0] : undefined;
    const costMicroUsd = Number(row?.cost_microusd_total);
    if (!Number.isFinite(costMicroUsd)) {
      return { ok: false, configured: true, limit, renewalDate, message: "Zyte response had no cost_microusd_total for this window (or an unexpected shape)." };
    }
    const usage = Math.round((costMicroUsd / 1_000_000) * 100) / 100; // USD
    return { ok: true, configured: true, usage, limit, renewalDate };
  } catch (e) {
    return { ok: false, configured: true, limit, renewalDate, message: "Zyte request failed: " + (e as Error).message };
  }
}
