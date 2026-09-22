import { Adapter, ProviderResult, env, notConfigured, fail, toNumber } from "./base";

const ME_URL = "https://platform.hootsuite.com/v1/me";

async function getUsage(): Promise<ProviderResult> {
  const token = env("HOOTSUITE_ACCESS_TOKEN");
  if (!token) return notConfigured("Set HOOTSUITE_ACCESS_TOKEN (OAuth2 bearer) in .env.local");

  try {
    // Hootsuite exposes API-CALL quota via response headers on any call.
    const res = await fetch(ME_URL, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return fail(`Hootsuite API returned HTTP ${res.status}`);

    const quota = toNumber(res.headers.get("X-Account-Quota"));
    const used = toNumber(res.headers.get("X-Account-Quota-Used"));
    if (quota == null || used == null) {
      return fail("Hootsuite did not return quota headers on this response");
    }
    return {
      usage: used,
      limit: quota,
      usageTracked: true,
      status: "ok",
      message: "API-call quota (Hootsuite does not expose subscription usage)",
    };
  } catch (e) {
    return fail("Hootsuite request failed: " + (e as Error).message);
  }
}

const hootsuite: Adapter = {
  id: "hootsuite",
  name: "Hootsuite",
  provider: "Hootsuite Social API",
  color: "#e11d48",
  unit: "API calls",
  getUsage,
};

export default hootsuite;
