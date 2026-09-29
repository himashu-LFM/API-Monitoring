import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny JSON blob store used for the little bits of state the app must keep
 * between runs: which alert thresholds have already been emailed, and the last
 * Decodo webhook.
 *
 * Two backends, chosen automatically:
 *
 *  - **Netlify Blobs** when running on Netlify. Required there, because each
 *    function invocation can get a fresh container: a file written by one
 *    request simply isn't there for the next. Losing the alert-dedup state that
 *    way is not a cosmetic bug — every cron run would think the threshold was
 *    new and re-send the email, which is exactly the mail flood this project
 *    already suffered once. Blobs is built into Netlify and needs no separate
 *    account or connection string; the runtime configures it automatically.
 *
 *  - **A local file under `.data/`** otherwise, so `npm run dev` keeps working
 *    with no extra services to run.
 */

/**
 * Netlify sets this in every deployed function. Using it (rather than NODE_ENV)
 * means local dev stays on files even with the Netlify CLI installed.
 */
function onNetlify(): boolean {
  return !!process.env.NETLIFY || !!process.env.NETLIFY_BLOBS_CONTEXT;
}

/** True when the durable backend is available. */
export function remoteStoreConfigured(): boolean {
  return onNetlify();
}

const STORE_NAME = "api-monitor";

function filePath(name: string): string {
  return path.join(process.cwd(), ".data", `${name}.json`);
}

async function readFileJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath(name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeFileJson(name: string, value: unknown): Promise<void> {
  const p = filePath(name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2), "utf8");
}

/** Imported lazily so local dev never loads the Netlify runtime. */
async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(STORE_NAME);
}

/** Read a stored blob, or null if it was never written. */
export async function readBlob<T>(name: string): Promise<T | null> {
  if (!remoteStoreConfigured()) return readFileJson<T>(name);
  const store = await netlifyStore();
  const raw = await store.get(name, { type: "text" });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write a stored blob.
 *
 * Deliberately not swallowing errors: a silent failure here means the dedup
 * record didn't stick and the next run re-sends the email. The caller must be
 * able to see that.
 */
export async function writeBlob(name: string, value: unknown): Promise<void> {
  if (!remoteStoreConfigured()) return writeFileJson(name, value);
  const store = await netlifyStore();
  await store.set(name, JSON.stringify(value));
}
