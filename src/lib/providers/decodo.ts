import "server-only";
import { readDecodoWebhookEvent } from "@/lib/webhook-store";
import { nextRenewalOnOrAfter, currentPeriodStart } from "@/lib/format";

/**
 * Real Decodo integration (server-side only — never import this from a
 * client component; the API key must stay off the browser).
 *
 * Confirmed from https://help.decodo.com/api-reference and
 * https://help.decodo.com/reference/public-api-key-authentication (2026-09):
 *
 *   "The Decodo Public API does not support datacenter and ISP product
 *    groups." — so for those two, /v2/subscriptions and the traffic-stats
 *   endpoint always come back empty (HTTP 200, no error). This isn't a
 *   config problem — Decodo just doesn't expose that data over REST for
 *   those plans. Confirmed by hand: valid key -> 200 + `[]` for every
 *   proxyType tried, vs 401 for a missing/bad key.
 *
 *   For Residential (full support) / Mobile (traffic + targets only):
 *     GET  https://api.decodo.com/v2/subscriptions
 *       -> { traffic_limit, traffic_per_period, users_limit,
 *            ip_address_limit, valid_from, valid_until, service_type }
 *     POST https://api.decodo.com/api/v2/statistics/traffic
 *       body: { proxyType, startDate, endDate, groupBy, limit, page }
 *       Response schema for this one is undocumented by Decodo, so the
 *       used-traffic field name is read from DECODO_TRAFFIC_FIELD rather
 *       than guessed.
 *
 *   For Datacenter / ISP (this account's plan): Decodo's own docs say
 *   webhooks are the one thing that *does* work for every proxy type,
 *   including datacenter. We receive a `traffic_usage` event (fires at
 *   80% and 100%) at /api/webhooks/decodo/[token] and read the latest
 *   one here. There's no renewal-date webhook, so renewal stays manual
 *   (DECODO_RENEWAL).
 *
 * Auth: `Authorization: <API_KEY>` header, no Bearer/Basic prefix
 * (confirmed by Decodo's own curl example).
 */

const BASE = "https://api.decodo.com";
const UNSUPPORTED_TYPES = new Set(["datacenter_proxies", "isp_proxies"]);

export interface DecodoSubscription {
  trafficLimitGb: number;
  validUntil: string; // ISO yyyy-mm-dd
  serviceType: string;
}

export interface DecodoUsageResult {
  ok: boolean;
  configured: boolean;
  mode: "rest" | "webhook";
  usageGb?: number;
  limitGb?: number;
  renewalDate?: string;
  message?: string;
  /**
   * Webhook mode only: has Decodo EVER delivered an event to us — in this cycle
   * or any earlier one?
   *
   * This is the difference between two states that otherwise look identical:
   * "the webhook is wired up and Decodo is simply quiet because usage is under
   * 80%", and "nothing is wired up at all". Decodo exposes no way to ask
   * whether our URL is registered, so a delivered event is the only proof the
   * connection works. Without this flag the UI marked the service live in both
   * cases, claiming a working integration it had no evidence for.
   */
  webhookSeen?: boolean;
  /**
   * Webhook mode only: Decodo has signalled THIS cycle that a traffic threshold
   * was crossed — true even when the exact percentage couldn't be parsed.
   *
   * Decodo sends `traffic_usage` only at 80% and 100%, never in between, so the
   * mere arrival of one is proof usage is at least 80%. The alert must not
   * depend on reading the number: on 2026-10-06 a real 80% event arrived, its
   * figure failed to parse, and because the checker keyed off the number alone,
   * no email was sent at all.
   */
  thresholdCrossed?: boolean;
  /** Present only when TRAFFIC_FIELD isn't set yet, to help you find it. */
  rawSample?: unknown;
}

function authHeader(apiKey: string): HeadersInit {
  return { Authorization: apiKey, Accept: "application/json" };
}

async function getSubscription(apiKey: string): Promise<DecodoSubscription> {
  const res = await fetch(`${BASE}/v2/subscriptions`, {
    headers: authHeader(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Decodo /v2/subscriptions returned HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    trafficLimitGb: Number(data.traffic_limit),
    validUntil: data.valid_until,
    serviceType: data.service_type,
  };
}

/** Sum used traffic for the last `days` days. Returns null if the field can't be found. */
async function getTrafficUsage(apiKey: string, proxyType: string, days: number, fieldName?: string) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

  const res = await fetch(`${BASE}/api/v2/statistics/traffic`, {
    method: "POST",
    headers: { ...authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      proxyType,
      startDate: fmt(start),
      endDate: fmt(end),
      groupBy: "day",
      limit: 500,
      page: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Decodo traffic stats returned HTTP ${res.status}`);
  }
  const data = await res.json();

  if (!fieldName) {
    const rows = Array.isArray(data) ? data : (data?.data ?? data?.results ?? data?.items ?? data);
    const sample = Array.isArray(rows) ? rows.slice(0, 2) : rows;
    return { usedGb: null as number | null, sample };
  }

  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.results ?? data?.items ?? []);
  let sum = 0;
  for (const row of rows) {
    const v = Number(row[fieldName]);
    if (Number.isFinite(v)) sum += v;
  }
  return { usedGb: sum, sample: undefined };
}

async function fetchViaRest(apiKey: string, proxyType: string): Promise<DecodoUsageResult> {
  const fieldName = process.env.DECODO_TRAFFIC_FIELD?.trim() || undefined;
  try {
    const [sub, traffic] = await Promise.all([
      getSubscription(apiKey),
      getTrafficUsage(apiKey, proxyType, 30, fieldName),
    ]);

    if (traffic.usedGb == null) {
      return {
        ok: false, configured: true, mode: "rest",
        limitGb: sub.trafficLimitGb,
        renewalDate: sub.validUntil,
        message: "DECODO_TRAFFIC_FIELD is not set — inspect rawSample below, then set it to the field holding used traffic.",
        rawSample: traffic.sample,
      };
    }
    return {
      ok: true, configured: true, mode: "rest",
      usageGb: Math.round(traffic.usedGb * 100) / 100,
      limitGb: sub.trafficLimitGb,
      renewalDate: sub.validUntil,
    };
  } catch (e) {
    return { ok: false, configured: true, mode: "rest", message: (e as Error).message };
  }
}

async function fetchViaWebhook(): Promise<DecodoUsageResult> {
  const anchor = process.env.DECODO_RENEWAL?.trim();
  const cycle = process.env.DECODO_BILLING_CYCLE?.trim() || "Monthly";
  // Set DECODO_RENEWAL once, to ANY known renewal date (past or future) —
  // this rolls it forward to the next real occurrence, so you never edit it again.
  const renewalDate = anchor ? nextRenewalOnOrAfter(anchor, cycle) : undefined;
  const token = process.env.DECODO_WEBHOOK_TOKEN?.trim();
  if (!token) {
    return {
      ok: false, configured: true, mode: "webhook", webhookSeen: false,
      renewalDate,
      message: "Datacenter/ISP proxies aren't supported by Decodo's REST API. Set DECODO_WEBHOOK_TOKEN and register https://<your-domain>/api/webhooks/decodo/<token> in the Decodo dashboard's Webhooks tab to get live threshold alerts instead.",
    };
  }

  const event = await readDecodoWebhookEvent();
  if (!event) {
    return {
      ok: false, configured: true, mode: "webhook", webhookSeen: false,
      renewalDate,
      message: "No webhook has ever reached this app, so the connection is unproven — the URL may not be registered in Decodo's dashboard, or the token may not match. Note that even a correct setup stays silent until traffic hits 80%, so this will keep saying the same thing until then.",
    };
  }

  // A webhook only describes the cycle it was sent in. Decodo's traffic resets
  // at renewal, but the stored event doesn't disappear — so without this check
  // last cycle's "80%" kept being reported as if it were current, and even
  // re-fired a threshold alert days after the reset.
  const periodStart = anchor ? currentPeriodStart(anchor, cycle) : undefined;
  const stale = periodStart != null && event.receivedAt < periodStart + "T00:00:00.000Z";
  if (stale) {
    return {
      ok: false, configured: true, mode: "webhook", webhookSeen: true, renewalDate,
      message: `Traffic reset on ${periodStart} and Decodo hasn't sent a webhook since — the last one (${event.usagePercent ?? "?"}% on ${event.receivedAt.slice(0, 10)}) belongs to the previous cycle. Datacenter plans stay silent until 80%, so no news here means under 80%.`,
    };
  }

  return {
    ok: event.usagePercent != null,
    configured: true,
    mode: "webhook",
    webhookSeen: true,
    // Only the usage event implies a crossing; e.g. a payment-failed webhook
    // must not be read as "80% reached".
    thresholdCrossed: event.eventName === "traffic_usage",
    usageGb: event.usagePercent ?? undefined, // treated as a 0-100 percentage, not GB
    limitGb: 100,
    renewalDate,
    message: event.usagePercent != null
      ? `Last webhook: ${event.eventName} at ${event.receivedAt} (usage ${event.usagePercent}%). Datacenter plans only report at 80%/100% thresholds, not continuously.`
      // Parsing failed. Show what Decodo actually sent rather than a bare "?" —
      // their payload schema is undocumented, and the first real event was lost
      // to a wrong field guess. Seeing the body here is what ends the guessing.
      : `A webhook arrived at ${event.receivedAt} but no usage percentage could be read from it. Raw payload: ${JSON.stringify(event.raw ?? {}).slice(0, 300)}`,
  };
}

export async function fetchDecodoUsage(): Promise<DecodoUsageResult> {
  const apiKey = process.env.DECODO_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, configured: false, mode: "rest", message: "Set DECODO_API_KEY in .env.local" };
  }
  const proxyType = process.env.DECODO_PROXY_TYPE?.trim() || "residential_proxies";

  if (UNSUPPORTED_TYPES.has(proxyType)) {
    return fetchViaWebhook();
  }
  return fetchViaRest(apiKey, proxyType);
}
