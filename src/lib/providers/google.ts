import "server-only";
import { JWT } from "google-auth-library";

/**
 * Real Google / YouTube quota integration (server-side only).
 *
 * YouTube (and every Google API) does NOT report your quota usage over its
 * own API — no header, no endpoint. The only programmatic source is Cloud
 * Monitoring, read here via a service account:
 *
 *   metric: serviceruntime.googleapis.com/quota/rate/net_usage
 *   filter: resource.labels.service = GOOGLE_SERVICE (e.g. youtube.googleapis.com)
 *   summed over the current quota day (YouTube resets at midnight PACIFIC).
 *
 * GOOGLE_SA_KEY is the service-account JSON, base64-encoded (avoids .env
 * quoting/newline pain); a raw JSON string is also accepted as a fallback.
 * The service account needs the "Monitoring Viewer" role on the project.
 *
 * GOOGLE_LIMIT is the daily quota cap (default 10000 for YouTube Data API v3)
 * — Cloud Monitoring also exposes .../quota/limit, but the default 10k is
 * stable and avoids a second query, so we read it from env.
 */

const MONITORING_BASE = "https://monitoring.googleapis.com/v3";
const NET_USAGE = "serviceruntime.googleapis.com/quota/rate/net_usage";

export interface GoogleUsageResult {
  ok: boolean;
  configured: boolean;
  usage?: number; // quota units consumed today
  limit?: number; // daily quota cap
  service?: string;
  message?: string;
}

interface SaKey { client_email: string; private_key: string; project_id?: string }

function loadSaKey(): SaKey | null {
  const raw = process.env.GOOGLE_SA_KEY?.trim();
  if (!raw) return null;
  try {
    // Prefer base64; fall back to a raw JSON string.
    const text = /^[A-Za-z0-9+/=\s]+$/.test(raw) && !raw.trim().startsWith("{")
      ? Buffer.from(raw, "base64").toString("utf8")
      : raw;
    const json = JSON.parse(text);
    if (json.client_email && json.private_key) return json;
    return null;
  } catch {
    return null;
  }
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

export async function fetchGoogleUsage(): Promise<GoogleUsageResult> {
  const sa = loadSaKey();
  const projectId = process.env.GOOGLE_PROJECT_ID?.trim();
  const service = process.env.GOOGLE_SERVICE?.trim() || "youtube.googleapis.com";
  const limit = process.env.GOOGLE_LIMIT?.trim() ? Number(process.env.GOOGLE_LIMIT) : 10000;

  if (!sa) return { ok: false, configured: false, message: "Set GOOGLE_SA_KEY (base64 service-account JSON) in .env.local" };
  if (!projectId) return { ok: false, configured: false, message: "Set GOOGLE_PROJECT_ID in .env.local" };

  try {
    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/monitoring.read"],
    });

    const start = pacificDayStartUTC();
    const end = new Date();
    const filter = `metric.type="${NET_USAGE}" AND resource.labels.service="${service}"`;

    const params = new URLSearchParams({
      filter,
      "interval.startTime": start.toISOString(),
      "interval.endTime": end.toISOString(),
      "aggregation.alignmentPeriod": "86400s",
      "aggregation.perSeriesAligner": "ALIGN_SUM",
      "aggregation.crossSeriesReducer": "REDUCE_SUM",
      view: "FULL",
    });

    const url = `${MONITORING_BASE}/projects/${projectId}/timeSeries?${params.toString()}`;
    const res = await client.request<{ timeSeries?: Array<{ points?: Array<{ value?: { int64Value?: string; doubleValue?: number } }> }> }>({ url });

    const series = res.data.timeSeries ?? [];
    let usage = 0;
    for (const ts of series) {
      for (const pt of ts.points ?? []) {
        const v = pt.value?.int64Value != null ? Number(pt.value.int64Value) : (pt.value?.doubleValue ?? 0);
        if (Number.isFinite(v)) usage += v;
      }
    }

    return { ok: true, configured: true, usage: Math.round(usage), limit, service };
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e);
    return { ok: false, configured: true, limit, service, message: "Google Monitoring request failed: " + msg };
  }
}
