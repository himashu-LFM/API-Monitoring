import "server-only";

/**
 * Real SadCaptcha integration (server-side only). Confirmed from
 * https://www.sadcaptcha.com/api/v1/swagger-ui/index.html (2026-09),
 * full documented schema:
 *
 *   GET https://www.sadcaptcha.com/api/v1/license/credits?licenseKey=<key>
 *   -> { "credits": <number> }        (400 Bad Request on invalid key)
 *
 * Auth is the license key as a QUERY PARAM (not a header) — that's how
 * SadCaptcha's own docs specify it, not a choice made here.
 *
 * This is a prepaid-credit system, not a subscription: the API only
 * reports credits REMAINING, never the total you originally purchased,
 * and there's no renewal/reset date at all (you top up manually whenever
 * you like). So "usage" here is only meaningful once you tell us the
 * total via SADCAPTCHA_TOTAL_CREDITS — same honesty pattern as Zyte's
 * spend budget.
 */

const BASE = "https://www.sadcaptcha.com/api/v1";

export interface SadCaptchaUsageResult {
  ok: boolean;
  configured: boolean;
  usage?: number; // credits consumed (total - remaining), only if total is known
  limit?: number; // total credits you've told us you purchased
  remaining?: number; // always present when ok
  message?: string;
}

export async function fetchSadCaptchaUsage(): Promise<SadCaptchaUsageResult> {
  const key = process.env.SADCAPTCHA_LICENSE_KEY?.trim();
  if (!key) return { ok: false, configured: false, message: "Set SADCAPTCHA_LICENSE_KEY in .env.local" };

  const totalStr = process.env.SADCAPTCHA_TOTAL_CREDITS?.trim();
  const total = totalStr ? Number(totalStr) : undefined;

  try {
    const res = await fetch(`${BASE}/license/credits?licenseKey=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, configured: true, message: `SadCaptcha returned HTTP ${res.status} (check the license key)` };
    }
    const data = await res.json();
    const remaining = Number(data?.credits);
    if (!Number.isFinite(remaining)) {
      return { ok: false, configured: true, message: "SadCaptcha response had no numeric `credits` field." };
    }

    if (total == null) {
      return {
        ok: true, configured: true, remaining,
        message: "Set SADCAPTCHA_TOTAL_CREDITS (how many credits you last topped up) to see this as a % used — the API only reports credits remaining, never the original total.",
      };
    }
    return { ok: true, configured: true, remaining, usage: Math.max(0, total - remaining), limit: total };
  } catch (e) {
    return { ok: false, configured: true, message: "SadCaptcha request failed: " + (e as Error).message };
  }
}
