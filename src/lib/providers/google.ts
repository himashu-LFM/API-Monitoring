import { Adapter, ProviderResult, env, envNum, notConfigured, fail, pickPath, toNumber } from "./base";

/**
 * Google has no single "usage" API, so this adapter is endpoint-driven:
 * point GOOGLE_USAGE_URL at the exact API/metric endpoint you want
 * (e.g. a Cloud Monitoring time-series query) and give the dot-path to
 * the numeric value via GOOGLE_USAGE_JSON_PATH. Auth is an API key
 * (?key=) or a bearer token (GOOGLE_BEARER).
 */
async function getUsage(): Promise<ProviderResult> {
  const url = env("GOOGLE_USAGE_URL");
  const apiKey = env("GOOGLE_API_KEY");
  const bearer = env("GOOGLE_BEARER");
  if (!url) {
    return notConfigured("Set GOOGLE_USAGE_URL to the API/metric endpoint you want to track");
  }
  if (!apiKey && !bearer) {
    return notConfigured("Set GOOGLE_API_KEY or GOOGLE_BEARER in .env.local");
  }

  const limit = envNum("GOOGLE_LIMIT");
  const jsonPath = env("GOOGLE_USAGE_JSON_PATH");
  const finalUrl = apiKey ? url + (url.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(apiKey) : url;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (bearer) headers.Authorization = "Bearer " + bearer;

  try {
    const res = await fetch(finalUrl, { headers, cache: "no-store" });
    if (!res.ok) return fail(`Google API returned HTTP ${res.status}`);
    const data = await res.json();
    const usage = toNumber(pickPath(data, jsonPath));
    if (usage == null) {
      return fail("Could not read usage from Google response — set GOOGLE_USAGE_JSON_PATH");
    }
    return { usage, limit, usageTracked: true, status: "ok" };
  } catch (e) {
    return fail("Google request failed: " + (e as Error).message);
  }
}

const google: Adapter = {
  id: "google",
  name: "Google",
  provider: "Google Cloud API",
  color: "#4285f4",
  unit: "requests",
  getUsage,
};

export default google;
