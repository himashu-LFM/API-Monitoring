import "server-only";
import protobuf from "protobufjs";

/**
 * Minimal OTLP/HTTP (protobuf) trace decoder — just enough of the
 * OpenTelemetry trace schema to pull the token-usage attributes off Anthropic's
 * spans. Field numbers match the OTLP proto spec; unknown fields are ignored.
 */

const PROTO = `
syntax = "proto3";
message ExportTraceServiceRequest { repeated ResourceSpans resource_spans = 1; }
message ResourceSpans { repeated ScopeSpans scope_spans = 2; }
message ScopeSpans { repeated Span spans = 2; }
message Span {
  bytes trace_id = 1;
  bytes span_id = 2;
  string name = 5;
  repeated KeyValue attributes = 9;
}
message KeyValue { string key = 1; AnyValue value = 2; }
message AnyValue {
  oneof value {
    string string_value = 1;
    bool bool_value = 2;
    int64 int_value = 3;
    double double_value = 4;
  }
}
`;

const root = protobuf.parse(PROTO).root;
const ExportTraceServiceRequest = root.lookupType("ExportTraceServiceRequest");

export interface DecodedSpan {
  traceId: string; // hex
  spanId: string;  // hex
  name: string;
  attrs: Record<string, string | number | boolean>;
}

function toHex(bytes: unknown): string {
  if (bytes instanceof Uint8Array) return Buffer.from(bytes).toString("hex");
  if (Buffer.isBuffer(bytes)) return bytes.toString("hex");
  return "";
}

function attrValue(v: Record<string, unknown> | undefined): string | number | boolean | undefined {
  // protobufjs decodes field names to camelCase.
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue as string;
  if (v.boolValue !== undefined) return v.boolValue as boolean;
  if (v.intValue !== undefined) return Number(v.intValue); // Long -> number
  if (v.doubleValue !== undefined) return v.doubleValue as number;
  return undefined;
}

/** Decode an OTLP protobuf trace-export body into a flat list of spans. */
export function decodeOtlpTraces(body: Buffer): DecodedSpan[] {
  // protobufjs decodes by field NUMBER (correct for any producer) but exposes
  // the JS object with camelCased field names. toObject({longs:Number}) turns
  // int64 token counts from Long objects into plain numbers.
  const decoded = ExportTraceServiceRequest.decode(body);
  const msg = ExportTraceServiceRequest.toObject(decoded, { longs: Number, defaults: false }) as unknown as {
    resourceSpans?: Array<{
      scopeSpans?: Array<{
        spans?: Array<{
          traceId?: unknown; spanId?: unknown; name?: string;
          attributes?: Array<{ key?: string; value?: Record<string, unknown> }>;
        }>;
      }>;
    }>;
  };

  const out: DecodedSpan[] = [];
  for (const rs of msg.resourceSpans ?? []) {
    for (const ss of rs.scopeSpans ?? []) {
      for (const sp of ss.spans ?? []) {
        const attrs: Record<string, string | number | boolean> = {};
        for (const kv of sp.attributes ?? []) {
          const val = attrValue(kv.value);
          if (kv.key && val !== undefined) attrs[kv.key] = val;
        }
        out.push({
          traceId: toHex(sp.traceId),
          spanId: toHex(sp.spanId),
          name: sp.name ?? "",
          attrs,
        });
      }
    }
  }
  return out;
}
