/**
 * Conceptual provider architecture for FUTURE real integrations.
 * These are NOT implemented yet — the current app runs entirely on the
 * centralized mock data in `lib/mock-data.ts`.
 *
 * Later, one adapter per provider will implement this interface and a
 * scheduled server-side job will call it, persist snapshots, and feed the
 * same UI. The UI stays provider-agnostic because it only reads `ApiService`.
 */
export interface ApiProviderAdapter {
  id: string;
  getUsage(): Promise<number>;
  getLimit(): Promise<number>;
  getRemaining(): Promise<number>;
  getRenewalDate(): Promise<Date>;
  getHealth(): Promise<boolean>;
}

// Planned adapters (to be implemented once official docs + credentials exist):
//   ZyteAdapter        — Zyte dashboard stats API
//   GoogleAdapter      — Google Cloud usage/monitoring
//   HootsuiteAdapter   — Hootsuite (API-call quota via headers)
//   DecodoAdapter      — Decodo traffic/subscription API
export type PlannedProviderId = "zyte" | "google" | "hootsuite" | "decodo";
