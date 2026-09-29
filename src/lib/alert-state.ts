import "server-only";
import { readBlob, writeBlob } from "./store";

/**
 * Remembers which usage thresholds have already been emailed, so a checker
 * running every 15 minutes doesn't send the same "90% reached" mail forever.
 *
 * Keyed by `<serviceId>:<cycleKey>` so the record resets on its own every
 * billing cycle — cross a threshold again next cycle and you get mailed again.
 *
 * Persisted through `store.ts`: a local file in dev, Upstash Redis once the
 * app is deployed. The remote backend is not optional on serverless — each
 * invocation can get a fresh container, so a file-only store would read back
 * empty every run and re-send every alert on every check.
 */

const NAME = "alert-state";

/** serviceId:cycleKey -> highest threshold already notified */
type AlertState = Record<string, number>;

async function read(): Promise<AlertState> {
  return (await readBlob<AlertState>(NAME)) ?? {};
}

async function write(state: AlertState): Promise<void> {
  await writeBlob(NAME, state);
}

export async function highestNotified(serviceId: string, cycleKey: string): Promise<number> {
  const state = await read();
  return state[`${serviceId}:${cycleKey}`] ?? 0;
}

export async function recordNotified(serviceId: string, cycleKey: string, threshold: number): Promise<void> {
  const state = await read();
  state[`${serviceId}:${cycleKey}`] = threshold;
  await write(state);
}

/** Drop records for cycles that are no longer current, so the file can't grow forever. */
export async function pruneOldCycles(currentKeys: string[]): Promise<void> {
  const state = await read();
  const keep: AlertState = {};
  for (const [k, v] of Object.entries(state)) {
    if (currentKeys.some((ck) => k.endsWith(`:${ck}`))) keep[k] = v;
  }
  await write(keep);
}
