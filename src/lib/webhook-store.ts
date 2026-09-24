import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Minimal file-backed store for incoming Decodo webhook events.
 * Datacenter/ISP proxies aren't covered by Decodo's REST API at all
 * (confirmed in their docs), so webhooks are the only real signal we
 * can get for those — this just persists the latest one so a server
 * restart during dev doesn't lose it. Swap for a real DB later if you
 * need history instead of "latest event only".
 */

const FILE = path.join(process.cwd(), ".data", "decodo-webhook.json");

export interface DecodoWebhookEvent {
  eventName: string;
  usagePercent: number | null;
  username: string | null;
  dateTime: string | null;
  receivedAt: string;
}

export async function saveDecodoWebhookEvent(event: DecodoWebhookEvent): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(event, null, 2), "utf8");
}

export async function readDecodoWebhookEvent(): Promise<DecodoWebhookEvent | null> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as DecodoWebhookEvent;
  } catch {
    return null;
  }
}
