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
 *   whole date range. We pass `groupby_time=day` instead, which returns one
 *   row PER DAY (each with an extra `day` field, ISO with a +00:00 offset) —
 *   verified live 2026-09-25. That costs nothing extra: it is the same single
 *   request, just grouped, so the 20 req/min limit is unaffected, and this
 *   stats host is not the billed one (billing is on api.zyte.com scraping
 *   requests — this endpoint only reports that spend).
 *
 *   The cycle total is the sum of those rows. (They were also charted on the
 *   detail page until that chart was removed; the grouping is kept because
 *   summing the per-day figures is what makes the total verifiable — it was
 *   cross-checked against the single-row total and matched to the cent.)
 *   Note `cost_microusd_total` arrives as a STRING, so it must be parsed.
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

/** One real day of Zyte spend, straight from the stats API. Internal only. */
interface ZyteDay {
  date: string;    // yyyy-mm-dd (UTC)
  usd: number;     // spend that day
  requests: number;
}

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
  const cycleStart = anchor
    ? new Date(currentPeriodStart(anchor, cycle) + "T00:00:00Z")
    : new Date(end.getTime() - 30 * 86400000);

  // Deliberately still only the current cycle: the chart plots spend as a
  // percentage of the cycle's budget, so days from a previous cycle would be
  // measured against the wrong denominator.
  const start = cycleStart;

  const auth = "Basic " + Buffer.from(apiKey + ":").toString("base64");
  const url = `${BASE}/api/stats?organization_id=${encodeURIComponent(orgId)}`
    + `&start_time=${encodeURIComponent(start.toISOString())}`
    + `&end_time=${encodeURIComponent(end.toISOString())}`
    + `&groupby_time=day`;

  try {
    const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
    if (res.status === 429) {
      return { ok: false, configured: true, limit, renewalDate, message: "Zyte stats API rate limit hit (20 req/min) — try again shortly." };
    }
    if (!res.ok) {
      return { ok: false, configured: true, limit, renewalDate, message: `Zyte stats API returned HTTP ${res.status}` };
    }
    const data = await res.json();
    const rows: unknown[] = Array.isArray(data?.results) ? data.results : [];
    if (rows.length === 0) {
      return { ok: false, configured: true, limit, renewalDate, message: "Zyte returned no rows for this window (or an unexpected shape)." };
    }

    const history: ZyteDay[] = [];
    let totalMicroUsd = 0;
    for (const r of rows as Record<string, unknown>[]) {
      const micro = Number(r.cost_microusd_total); // arrives as a string
      const day = typeof r.day === "string" ? r.day.slice(0, 10) : null;
      if (!day || !Number.isFinite(micro)) continue;
      totalMicroUsd += micro; // summed raw, so the total isn't the sum of 15 roundings
      history.push({
        date: day,
        usd: Math.round((micro / 1_000_000) * 100) / 100,
        requests: Number(r.request_count) || 0,
      });
    }
    if (history.length === 0) {
      return { ok: false, configured: true, limit, renewalDate, message: "Zyte rows had no usable day/cost_microusd_total values." };
    }
    history.sort((a, b) => a.date.localeCompare(b.date));

    const usage = Math.round((totalMicroUsd / 1_000_000) * 100) / 100;

    return { ok: true, configured: true, usage, limit, renewalDate };
  } catch (e) {
    return { ok: false, configured: true, limit, renewalDate, message: "Zyte request failed: " + (e as Error).message };
  }
}
