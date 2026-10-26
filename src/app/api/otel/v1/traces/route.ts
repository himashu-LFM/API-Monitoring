import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { decodeOtlpTraces } from "@/lib/otel/decode";
import { recordSpans, type SpanRecord } from "@/lib/otel/store";

export const runtime = "nodejs"; // protobufjs + zlib need the node runtime
export const dynamic = "force-dynamic";

/**
 * OTLP/HTTP trace receiver for Anthropic's OpenTelemetry export. Anthropic POSTs
 * a protobuf batch of spans here (one span per Messages API request) with the
 * token usage. We decode, sum the usage, and store it — used to estimate spend
 * when the Cost API isn't available (individual orgs).
 *
 * Protected by a bearer secret (OTEL_INGEST_SECRET) that must match the header
 * configured on the destination in the Claude Console. Returns 200 fast so
 * Anthropic doesn't disable the destination (>5s or a 3xx redirect disables it).
 */

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function POST(req: Request) {
  const secret = process.env.OTEL_INGEST_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (auth !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    let body = Buffer.from(await req.arrayBuffer());
    if ((req.headers.get("content-encoding") ?? "").toLowerCase().includes("gzip")) {
      body = gunzipSync(body);
    }

    const spans = decodeOtlpTraces(body);
    const records: SpanRecord[] = [];
    for (const sp of spans) {
      // Count the top-level Messages API span (it carries the request's full
      // usage) — not its model_request children, to avoid double-counting.
      if (sp.name !== "anthropic.messages.create") continue;
      const a = sp.attrs;
      const hasUsage = a["gen_ai.usage.input_tokens"] !== undefined || a["gen_ai.usage.output_tokens"] !== undefined;
      if (!hasUsage || !sp.spanId) continue;

      records.push({
        id: `${sp.traceId}_${sp.spanId}`,
        model: String(a["gen_ai.response.model"] ?? a["gen_ai.request.model"] ?? ""),
        inputTokens: num(a["gen_ai.usage.input_tokens"]),
        outputTokens: num(a["gen_ai.usage.output_tokens"]),
        cacheReadTokens: num(a["gen_ai.usage.cache_read.input_tokens"]),
        cacheWriteTokens: num(a["gen_ai.usage.cache_write.input_tokens"]),
        batch: String(a["anthropic.response.service_tier"] ?? "") === "batch",
      });
    }

    await recordSpans(records);
    // OTLP expects a protobuf ExportTraceServiceResponse; an empty body is valid.
    return new NextResponse(null, { status: 200, headers: { "content-type": "application/x-protobuf" } });
  } catch (e) {
    // Still 200 — a 5xx just makes Anthropic retry the same batch (deduped
    // anyway), and repeated failures disable the destination.
    console.error("[otel] decode/store failed:", (e as Error).message);
    return new NextResponse(null, { status: 200 });
  }
}
