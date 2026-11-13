import "server-only";
import { readBlob, writeBlob } from "./store";

/**
 * Values recorded from the dashboard, overriding the matching env vars.
 *
 * Neither has an API — Zyte doesn't expose its spending limit, and Decodo's
 * datacenter plan (webhook mode) exposes no renewal date — so a human has to
 * supply them. Kept in env, each change meant editing Netlify settings and
 * redeploying (15 Netlify credits and a few minutes). Here they live in the
 * same store as the alert dedup state (Netlify Blobs in prod, a file in dev):
 * saving one takes effect on the next fetch, with no deploy.
 *
 * The env vars stay as the fallback, so nothing changes until a value is first
 * recorded here.
 */

const NAME = "topups";

export interface ZyteTopup {
  /** New USD spending limit for the cycle (replaces ZYTE_LIMIT). */
  limit: number;
  at: string; // ISO timestamp of when it was recorded
}

export interface DecodoRenewal {
  /** yyyy-mm-dd, any known renewal date (replaces DECODO_RENEWAL as the anchor). */
  renewal: string;
  at: string;
}

export interface Topups {
  zyte?: ZyteTopup;
  decodo?: DecodoRenewal;
}

export type TopupService = keyof Topups;

export async function readTopups(): Promise<Topups> {
  return (await readBlob<Topups>(NAME)) ?? {};
}

export async function saveTopup<K extends TopupService>(service: K, value: NonNullable<Topups[K]>): Promise<void> {
  const all = await readTopups();
  all[service] = value;
  await writeBlob(NAME, all);
}
