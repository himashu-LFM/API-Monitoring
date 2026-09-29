import "server-only";
import crypto from "node:crypto";

/**
 * Real Google (YouTube Data API) usage via Cloud Monitoring — server-side only
 * (the service-account key must never reach the browser).
 *
 * The YouTube API doesn't expose remaining quota, so we read Cloud Monitoring:
 *   - used  = sum of serviceruntime.googleapis.com/quota/rate/net_usage for the
 *             service, from midnight Pacific (quota reset) to now.
 *   - limit = the per-day serviceruntime.googleapis.com/quota/limit for the
 *             service's "default" quota metric (auto-detected — could be the
 *             10k default or a granted increase).
 *
 * Env (.env.local):
 *   GOOGLE_PROJECT_ID  — project number is safest (e.g. 729812345709)
 *   GOOGLE_SA_KEY      — full service-account JSON on one line, OR
 *   GOOGLE_SA_KEY_FILE — path to the JSON key file
 *   GOOGLE_SERVICE     — default "youtube.googleapis.com"
 * The service account needs the "Monitoring Viewer" role, and the project
 * needs billing enabled (Monitoring API reads are free-tier).
 */

const MON = "https://monitoring.googleapis.com/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleUsageResult {
  ok: boolean;
  configured: boolean;
  usage?: number; // units consumed today
  limit?: number; // daily quota cap
  unit?: string;
  message?: string;
}

interface SaKey { client_email: string; private_key: string; }

function loadSaKey(): SaKey | null {
  const raw = process.env.GOOGLE_SA_KEY?.trim();
  if (raw) return JSON.parse(raw);
  const file = process.env.GOOGLE_SA_KEY_FILE?.trim();
  if (file) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs") as typeof import("node:fs");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mint a Google OAuth access token from the service-account key (RS256 JWT). */
async function getAccessToken(sa: SaKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/monitoring.read",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signature = base64url(crypto.sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`token exchange HTTP ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

function iso(d: Date) { return d.toISOString().replace(/\.\d{3}Z$/, "Z"); }

/** Start of the current day in US Pacific (when YouTube quota resets). */
function pacificMidnightUtc(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hourCycle: "h23",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // Seconds elapsed since midnight Pacific → subtract from now to get that instant.
  const secsSinceMidnight = g("hour") * 3600 + g("minute") * 60 + g("second");
  return new Date(now.getTime() - secsSinceMidnight * 1000);
}

async function timeSeries(token: string, project: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${MON}/projects/${project}/timeSeries?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Monitoring HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function fetchGoogleUsage(): Promise<GoogleUsageResult> {
  const project = process.env.GOOGLE_PROJECT_ID?.trim();
  const service = process.env.GOOGLE_SERVICE?.trim() || "youtube.googleapis.com";
  const sa = (() => { try { return loadSaKey(); } catch { return null; } })();

  if (!project) return { ok: false, configured: false, message: "Set GOOGLE_PROJECT_ID in .env.local" };
  if (!sa) return { ok: false, configured: false, message: "Set GOOGLE_SA_KEY (JSON) or GOOGLE_SA_KEY_FILE in .env.local" };

  try {
    const token = await getAccessToken(sa);
    const now = new Date();
    const start = pacificMidnightUtc();
    const windowSecs = Math.max(60, Math.round((now.getTime() - start.getTime()) / 1000));

    // Used today.
    const usageData = await timeSeries(token, project, {
      // Only the overall daily quota (matches the console's "Queries per day");
      // without the quota_metric filter we'd also add per-method sub-quotas
      // (search_list, etc.) and double-count search usage.
      filter: `metric.type="serviceruntime.googleapis.com/quota/rate/net_usage" AND resource.labels.service="${service}" AND metric.labels.quota_metric="${service}/default"`,
      "interval.startTime": iso(start),
      "interval.endTime": iso(now),
      "aggregation.alignmentPeriod": `${windowSecs}s`,
      "aggregation.perSeriesAligner": "ALIGN_SUM",
      "aggregation.crossSeriesReducer": "REDUCE_SUM",
    });
    let used = 0;
    for (const s of usageData.timeSeries ?? []) {
      for (const p of s.points ?? []) {
        used += Number(p.value.int64Value ?? p.value.doubleValue ?? 0);
      }
    }

    // Daily limit (auto-detected).
    const sixHrsAgo = new Date(now.getTime() - 6 * 3600_000);
    const limitData = await timeSeries(token, project, {
      filter: `metric.type="serviceruntime.googleapis.com/quota/limit" AND resource.labels.service="${service}"`,
      "interval.startTime": iso(sixHrsAgo),
      "interval.endTime": iso(now),
    });
    let limit = 0;
    for (const s of limitData.timeSeries ?? []) {
      const labels = s.metric?.labels ?? {};
      if (String(labels.quota_metric ?? "").endsWith("/default")
          && String(labels.limit_name ?? "").toLowerCase().includes("day")) {
        const pts = s.points ?? [];
        if (pts.length) limit = Math.max(limit, Number(pts[0].value.int64Value ?? pts[0].value.doubleValue ?? 0));
      }
    }

    return {
      ok: true,
      configured: true,
      usage: used,
      limit: limit || undefined,
      unit: "units",
    };
  } catch (e) {
    return { ok: false, configured: true, message: "Google request failed: " + (e as Error).message };
  }
}
