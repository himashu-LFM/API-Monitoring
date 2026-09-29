import "server-only";
import { readBlob, writeBlob } from "./store";

/**
 * Stores the latest incoming Decodo webhook event.
 * Datacenter/ISP proxies aren't covered by Decodo's REST API at all
 * (confirmed in their docs), so webhooks are the only real signal we can get
 * for those. Persisted through `store.ts`, which means a local file in dev and
 * Upstash Redis on a deployed (serverless) host — a webhook only arrives every
 * few days, so it must survive far longer than one container's lifetime.
 * Latest event only; swap for a list if you ever need history.
 */

const NAME = "decodo-webhook";

export interface DecodoWebhookEvent {
  eventName: string;
  usagePercent: number | null;
  username: string | null;
  dateTime: string | null;
  receivedAt: string;
}

export async function saveDecodoWebhookEvent(event: DecodoWebhookEvent): Promise<void> {
  await writeBlob(NAME, event);
}

export async function readDecodoWebhookEvent(): Promise<DecodoWebhookEvent | null> {
  return readBlob<DecodoWebhookEvent>(NAME);
}
