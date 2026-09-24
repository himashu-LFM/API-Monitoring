import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Remembers which usage thresholds have already been emailed, so a checker
 * running every 15 minutes doesn't send the same "90% reached" mail forever.
 *
 * Keyed by `<serviceId>:<cycleKey>` so the record resets on its own every
 * billing cycle — cross a threshold again next cycle and you get mailed again.
 *
 * File-backed, which is fine locally and in a CI runner that persists the
 * file. On serverless (Vercel) the filesystem is ephemeral, so this degrades
 * to "may re-send after a cold start" — see README for the deployment note.
 */

const FILE = path.join(process.cwd(), ".data", "alert-state.json");

/** serviceId:cycleKey -> highest threshold already notified */
type AlertState = Record<string, number>;

async function read(): Promise<AlertState> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as AlertState;
  } catch {
    return {};
  }
}

async function write(state: AlertState): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
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
