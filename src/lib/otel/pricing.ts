import "server-only";

/**
 * Per-model token prices (USD per 1M tokens) for estimating spend from OTel
 * token counts. Cache-read ≈ 0.1× input; cache-write (5m) ≈ 1.25× input — the
 * standard Anthropic cache multipliers. Batch service tier is billed at 50%.
 *
 * These are estimates — OTel is not bill-exact (that needs the Cost API). Keep
 * this table roughly current; a wrong price only skews the estimate, it can't
 * break anything.
 */

interface Price { in: number; out: number } // USD per 1M tokens

// Longest-prefix match wins, so list specific ids. Falls back to DEFAULT.
const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-opus-4-5": { in: 5, out: 25 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-fable-5-1": { in: 10, out: 50 },
  "claude-fable-5": { in: 10, out: 50 },
  "claude-3-5-haiku": { in: 0.8, out: 4 },
  "claude-3-5-sonnet": { in: 3, out: 15 },
};
const DEFAULT: Price = { in: 5, out: 25 }; // Opus-ish, if the model is unknown

function priceFor(model: string): Price {
  const m = (model || "").toLowerCase();
  let best = "";
  for (const key of Object.keys(PRICES)) {
    if (m.startsWith(key) && key.length > best.length) best = key;
  }
  return best ? PRICES[best] : DEFAULT;
}

export interface SpanTokens {
  model: string;
  inputTokens: number;       // includes cache read + write
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  batch: boolean;
}

/** Estimate the USD cost of one span's token usage. */
export function priceSpan(t: SpanTokens): number {
  const p = priceFor(t.model);
  const uncachedIn = Math.max(0, t.inputTokens - t.cacheReadTokens - t.cacheWriteTokens);
  const perTok = (usd: number) => usd / 1_000_000;
  let cost =
    uncachedIn * perTok(p.in) +
    t.cacheReadTokens * perTok(p.in * 0.1) +
    t.cacheWriteTokens * perTok(p.in * 1.25) +
    t.outputTokens * perTok(p.out);
  if (t.batch) cost *= 0.5;
  return cost;
}
