import "server-only";
import { JWT } from "google-auth-library";

/**
 * Real Google (YouTube Data API) usage via Cloud Monitoring — server-side only
 * (the service-account key must never reach the browser).
 *
 * YouTube (and every Google API) does NOT report quota usage over its own API —
 * no header, no endpoint. The only programmatic source is Cloud Monitoring:
 *
 *   used  = sum of serviceruntime.googleapis.com/quota/rate/net_usage for the
 *           service, from midnight Pacific (quota reset) to now. The query is
 *           pinned to quota_metric="<service>/default" so per-method sub-quotas
 *           (search_list, etc.) are not double-counted.
 *   limit = the per-day serviceruntime.googleapis.com/quota/limit for the
 *           service's "default" quota metric (auto-detected — could be the 10k
 *           default or a granted increase). Override with GOOGLE_LIMIT.
 *
 * Env (.env.local):
 *   GOOGLE_PROJECT_ID  — project number is safest (e.g. 729812345709)
 *   GOOGLE_SA_KEY      — service-account JSON, base64-encoded (avoids .env
 *                        quoting/newline pain); a raw JSON string also works
 *   GOOGLE_SA_KEY_FILE — path to the JSON key file (alternative to the above)
 *   GOOGLE_SERVICE     — default "youtube.googleapis.com"
 *   GOOGLE_LIMIT       — optional hard override for the daily cap
 * The service account needs the "Monitoring Viewer" role, and the project
 * needs billing enabled (Monitoring API reads are free-tier).
 */

const MONITORING_BASE = "https://monitoring.googleapis.com/v3";
const NET_USAGE = "serviceruntime.googleapis.com/quota/rate/net_usage";
const QUOTA_LIMIT = "serviceruntime.googleapis.com/quota/limit";
const DEFAULT_LIMIT = 10000;

export interface GoogleUsageResult {
  ok: boolean;
  configured: boolean;
  usage?: number; // quota units consumed today
  limit?: number; // daily quota cap
  unit?: string;
  service?: string;
  message?: string;
}

interface SaKey { client_email: string; private_key: string; project_id?: string }

/**
 * Accepts the key as base64 JSON, raw JSON, or a path via GOOGLE_SA_KEY_FILE.
 * Returns null (never throws) so a bad key surfaces as "not configured".
 */
function loadSaKey(): SaKey | null {
  const raw = process.env.GOOGLE_SA_KEY?.trim();
  if (raw) {
    try {
      // Prefer base64; fall back to a raw JSON string.
      const text = /^[A-Za-z0-9+/=\s]+$/.test(raw) && !raw.startsWith("{")
        ? Buffer.from(raw, "base64").toString("utf8")
        : raw;
      const json = JSON.parse(text);
      if (json.client_email && json.private_key) return json;
    } catch {
      /* fall through to the file form */
    }
  }

  const file = process.env.GOOGLE_SA_KEY_FILE?.trim();
  if (file) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("node:fs") as typeof import("node:fs");
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      if (json.client_email && json.private_key) return json;
    } catch {
      return null;
    }
  }
  return null;
}

/** UTC instant of the most recent midnight in America/Los_Angeles (YouTube quota reset). */
function pacificDayStartUTC(now = new Date()): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(now).map((x) => [x.type, x.value])) as Record<string, string>;
  const wallAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMs = wallAsUTC - now.getTime(); // (PT wall) - (real UTC)
  const midnightWallAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, 0, 0, 0);
  return new Date(midnightWallAsUTC - offsetMs);
}

interface TimeSeriesPoint { value?: { int64Value?: string; doubleValue?: number } }
interface TimeSeries { metric?: { labels?: Record<string, string> }; points?: TimeSeriesPoint[] }

function pointValue(pt: TimeSeriesPoint): number {
  const v = pt.value?.int64Value != null ? Number(pt.value.int64Value) : (pt.value?.doubleValue ?? 0);
  return Number.isFinite(v) ? v : 0;
}

async function timeSeries(client: JWT, project: string, params: Record<string, string>): Promise<TimeSeries[]> {
  const url = `${MONITORING_BASE}/projects/${project}/timeSeries?${new URLSearchParams(params).toString()}`;
  const res = await client.request<{ timeSeries?: TimeSeries[] }>({ url });
  return res.data.timeSeries ?? [];
}

export async function fetchGoogleUsage(): Promise<GoogleUsageResult> {
  const projectId = process.env.GOOGLE_PROJECT_ID?.trim();
  const service = process.env.GOOGLE_SERVICE?.trim() || "youtube.googleapis.com";
  const envLimit = process.env.GOOGLE_LIMIT?.trim() ? Number(process.env.GOOGLE_LIMIT) : undefined;
  const sa = loadSaKey();

  if (!projectId) return { ok: false, configured: false, service, message: "Set GOOGLE_PROJECT_ID in .env.local" };
  if (!sa) {
    return {
      ok: false, configured: false, service,
      message: "Set GOOGLE_SA_KEY (base64 service-account JSON) or GOOGLE_SA_KEY_FILE in .env.local",
    };
  }

  try {
    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/monitoring.read"],
    });

    const now = new Date();
    const start = pacificDayStartUTC(now);
    const windowSecs = Math.max(60, Math.round((now.getTime() - start.getTime()) / 1000));

    // Used today. Pinned to the "<service>/default" quota metric — matching the
    // console's "Queries per day". Without that filter the per-method
    // sub-quotas (search_list, etc.) are summed in too and search is
    // double-counted.
    const usageSeries = await timeSeries(client, projectId, {
      filter: `metric.type="${NET_USAGE}" AND resource.labels.service="${service}"`
        + ` AND metric.labels.quota_metric="${service}/default"`,
      "interval.startTime": start.toISOString(),
      "interval.endTime": now.toISOString(),
      "aggregation.alignmentPeriod": `${windowSecs}s`,
      "aggregation.perSeriesAligner": "ALIGN_SUM",
      "aggregation.crossSeriesReducer": "REDUCE_SUM",
      view: "FULL",
    });

    let usage = 0;
    for (const ts of usageSeries) {
      for (const pt of ts.points ?? []) usage += pointValue(pt);
    }

    // Daily limit: explicit env override wins; otherwise auto-detect from
    // Cloud Monitoring (picks up a granted increase over the 10k default).
    let limit = envLimit;
    if (limit == null) {
      try {
        const sixHrsAgo = new Date(now.getTime() - 6 * 3600_000);
        const limitSeries = await timeSeries(client, projectId, {
          filter: `metric.type="${QUOTA_LIMIT}" AND resource.labels.service="${service}"`,
          "interval.startTime": sixHrsAgo.toISOString(),
          "interval.endTime": now.toISOString(),
        });
        let detected = 0;
        for (const ts of limitSeries) {
          const labels = ts.metric?.labels ?? {};
          if (String(labels.quota_metric ?? "").endsWith("/default")
              && String(labels.limit_name ?? "").toLowerCase().includes("day")) {
            const pts = ts.points ?? [];
            if (pts.length) detected = Math.max(detected, pointValue(pts[0]));
          }
        }
        if (detected > 0) limit = detected;
      } catch {
        // Auto-detection is best-effort — fall back to the default below.
      }
    }

    return {
      ok: true,
      configured: true,
      usage: Math.round(usage),
      limit: limit ?? DEFAULT_LIMIT,
      unit: "units",
      service,
    };
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e);
    return {
      ok: false, configured: true, service,
      limit: envLimit ?? DEFAULT_LIMIT,
      message: "Google Monitoring request failed: " + msg,
    };
  }
}
