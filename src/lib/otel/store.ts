import "server-only";
import { readBlob, writeBlob } from "@/lib/store";
import { priceSpan } from "./pricing";

/**
 * OTel usage aggregate. Token counts are grouped by (model, batch-tier) and
 * priced at READ time, so a price-table fix applies retroactively. Spans are
 * deduped by trace+span id ("seen"), because OTel delivery is at-least-once.
 *
 * Single aggregate blob (via lib/store: Netlify Blobs in prod, a file locally),
 * so reads are O(1). The receiver is the only writer and Anthropic's deliveries
 * are effectively sequential, so read-modify-write races are negligible — and
 * OTel is an estimate anyway.
 */

const NAME = "otel-usage";

export interface SpanRecord {
  id: string; // `${traceId}_${spanId}`
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  batch: boolean;
}

interface Group {
  model: string;
  batch: boolean;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
}

interface Agg {
  groups: Record<string, Group>;
  seen: Record<string, 1>;
  spanCount: number;
}

function empty(): Agg {
  return { groups: {}, seen: {}, spanCount: 0 };
}

/** Add newly-seen spans to the aggregate (idempotent per span id). */
export async function recordSpans(spans: SpanRecord[]): Promise<void> {
  if (spans.length === 0) return;
  const agg = (await readBlob<Agg>(NAME)) ?? empty();
  let changed = false;

  for (const s of spans) {
    if (agg.seen[s.id]) continue; // already counted
    agg.seen[s.id] = 1;
    agg.spanCount++;
    const key = `${s.model}::${s.batch ? "batch" : "std"}`;
    const g = agg.groups[key] ?? { model: s.model, batch: s.batch, in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
    g.in += s.inputTokens;
    g.out += s.outputTokens;
    g.cacheRead += s.cacheReadTokens;
    g.cacheWrite += s.cacheWriteTokens;
    agg.groups[key] = g;
    changed = true;
  }

  if (changed) await writeBlob(NAME, agg);
}

/** Total estimated USD across all recorded spans, priced at read time. */
export async function otelTotalUsd(): Promise<{ usd: number; spanCount: number } | null> {
  const agg = await readBlob<Agg>(NAME);
  if (!agg) return null;
  let usd = 0;
  for (const g of Object.values(agg.groups)) {
    usd += priceSpan({
      model: g.model,
      inputTokens: g.in,
      outputTokens: g.out,
      cacheReadTokens: g.cacheRead,
      cacheWriteTokens: g.cacheWrite,
      batch: g.batch,
    });
  }
  return { usd: Math.round(usd * 100) / 100, spanCount: agg.spanCount };
}
