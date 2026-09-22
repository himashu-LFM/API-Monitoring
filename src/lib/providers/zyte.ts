import { Adapter, ProviderResult, env, envNum, notConfigured, fail, toNumber } from "./base";

const STATS_URL = "https://zyte-api-stats.zyte.com/api/stats";

/** Best-effort extraction of a request/usage count from the Zyte stats payload. */
function extractRequests(data: unknown): number | null {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const direct = toNumber(obj.requests) ?? toNumber(obj.total) ?? toNumber(obj.count);
    if (direct != null) return direct;
    // Some responses nest rows under `data` / `stats` — sum their request counts.
    const rows = (Array.isArray(obj.data) && obj.data) || (Array.isArray(obj.stats) && obj.stats);
    if (Array.isArray(rows)) {
      let sum = 0, found = false;
      for (const row of rows) {
        const n = toNumber((row as Record<string, unknown>)?.requests) ??
          toNumber((row as Record<string, unknown>)?.count);
        if (n != null) { sum += n; found = true; }
      }
      if (found) return sum;
    }
  }
  return null;
}

async function getUsage(): Promise<ProviderResult> {
  const key = env("ZYTE_API_KEY");
  const org = env("ZYTE_ORG_ID");
  if (!key) return notConfigured("Set ZYTE_API_KEY (dashboard API key) in .env.local");
  if (!org) return notConfigured("Set ZYTE_ORG_ID in .env.local");

  const limit = envNum("ZYTE_LIMIT");
  const auth = "Basic " + Buffer.from(key + ":").toString("base64");
  const url = `${STATS_URL}?organization_id=${encodeURIComponent(org)}`;

  try {
    const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
    if (!res.ok) return fail(`Zyte stats API returned HTTP ${res.status}`);
    const data = await res.json();
    const usage = extractRequests(data);
    if (usage == null) {
      return fail("Could not read a request count from the Zyte response — check adapter mapping");
    }
    return { usage, limit, usageTracked: true, status: "ok" };
  } catch (e) {
    return fail("Zyte request failed: " + (e as Error).message);
  }
}

const zyte: Adapter = {
  id: "zyte",
  name: "Zyte",
  provider: "Zyte API",
  color: "#e05d2f",
  unit: "requests",
  getUsage,
};

export default zyte;
