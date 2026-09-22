import type { FetchStatus } from "@/lib/types";

export interface ProviderResult {
  usage: number | null;
  limit: number | null;
  usageTracked: boolean;
  status: FetchStatus;
  message?: string;
}

export interface Adapter {
  id: string;
  name: string;
  provider: string;
  color: string;
  unit: string;
  getUsage(): Promise<ProviderResult>;
}

/** Read a trimmed, non-empty env var, or undefined. */
export function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

export function envNum(key: string): number | null {
  const v = env(key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function notConfigured(message: string): ProviderResult {
  return { usage: null, limit: null, usageTracked: true, status: "not_configured", message };
}

export function fail(message: string): ProviderResult {
  return { usage: null, limit: null, usageTracked: true, status: "error", message };
}

/** Follow a dot-path (e.g. "data.usage.total") into a JSON object. */
export function pickPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
