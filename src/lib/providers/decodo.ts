import { Adapter, ProviderResult, env, envNum, notConfigured, fail, pickPath, toNumber } from "./base";

async function getUsage(): Promise<ProviderResult> {
  const key = env("DECODO_API_KEY");
  const url = env("DECODO_USAGE_URL");
  if (!key) return notConfigured("Set DECODO_API_KEY in .env.local");
  if (!url) {
    return notConfigured(
      "Set DECODO_USAGE_URL to your traffic/subscription endpoint (base https://api.decodo.com/v1)"
    );
  }

  const limit = envNum("DECODO_LIMIT");
  const jsonPath = env("DECODO_USAGE_JSON_PATH");
  // Decodo public API uses the API key as a Basic-auth token.
  const auth = "Basic " + Buffer.from(key + ":").toString("base64");

  try {
    const res = await fetch(url, {
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return fail(`Decodo API returned HTTP ${res.status}`);
    const data = await res.json();

    let usage: number | null = null;
    if (jsonPath) {
      usage = toNumber(pickPath(data, jsonPath));
    } else if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      usage = toNumber(o.traffic_used) ?? toNumber(o.used) ?? toNumber(o.usage);
    }
    if (usage == null) {
      return fail("Could not read used traffic from Decodo — set DECODO_USAGE_JSON_PATH");
    }
    return { usage, limit, usageTracked: true, status: "ok" };
  } catch (e) {
    return fail("Decodo request failed: " + (e as Error).message);
  }
}

const decodo: Adapter = {
  id: "decodo",
  name: "Decodo",
  provider: "Decodo Proxy Network",
  color: "#0ea5e9",
  unit: "GB",
  getUsage,
};

export default decodo;
