/**
 * Alert rules that both the server (alert-checker) and the UI need to agree on.
 *
 * Deliberately a plain constant rather than an env var: the detail page shows
 * this number to the user, and a server-only env var would let the displayed
 * figure drift away from the one that actually fires the email.
 */

/**
 * SadCaptcha credits are prepaid and never expire, so a percentage threshold is
 * meaningless (there is no "cycle" to be a percentage of). We email once when
 * the remaining balance falls below this floor, and re-arm after a top-up.
 */
export const LOW_BALANCE_FLOOR = 20_000;
