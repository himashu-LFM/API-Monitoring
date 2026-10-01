/**
 * Alert rules — the single place that defines WHEN each service alerts.
 * Both the server (alert-checker) and the UI read these, so the number shown
 * to the user always matches the one that actually fires the email.
 *
 * These are plain constants on purpose: edit + redeploy to change a rule.
 */

// ── Decodo ────────────────────────────────────────────────────
// Critical alert the moment usage reaches this % of the plan.
export const DECODO_CRITICAL_PCT = 80;

// ── SadCaptcha (prepaid credits, no expiry) ──────────────────
// Judged on credits REMAINING, in two descending tiers:
//   WARN → first heads-up · CRIT → urgent, credits about to run out
export const SADCAPTCHA_TIER_WARN = 1_000_000; // TEMP TEST — revert to 1_000_000 after email confirmed
export const SADCAPTCHA_TIER_CRIT = 500_000;   //  5,00,000 left

// Back-compat alias (older UI referenced this name).
export const LOW_BALANCE_FLOOR = SADCAPTCHA_TIER_WARN;

// ── Zyte (USD budget over a billing cycle) ───────────────────
// Rule 1: over EARLY_PCT of budget while more than EARLY_MIN_DAYS days remain
//         in the cycle → burning too fast, early warning.
// Rule 2: at/over CRITICAL_PCT of budget → urgent, regardless of days.
export const ZYTE_EARLY_PCT = 50;
export const ZYTE_EARLY_MIN_DAYS = 15;
export const ZYTE_CRITICAL_PCT = 80;

// ── YouTube Data API (daily quota, resets midnight Pacific) ──
// Hitting PCT this early in the day means you'll likely run out before the
// reset. Only fires if crossed BEFORE this Pacific time (12:01 PM).
export const YOUTUBE_PCT = 80;
export const YOUTUBE_CUTOFF_HOUR = 12;   // noon PT
export const YOUTUBE_CUTOFF_MINUTE = 1;  // ...:01
