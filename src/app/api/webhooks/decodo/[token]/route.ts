import { NextResponse } from "next/server";
import { saveDecodoWebhookEvent } from "@/lib/webhook-store";

export const dynamic = "force-dynamic";

/**
 * Receives Decodo webhooks (Account Settings -> Webhooks -> URL).
 * Decodo's docs don't document any request-signing scheme, so the only
 * safeguard here is the random [token] segment in the URL itself — treat
 * it like a password: keep it out of git, and only Decodo's dashboard
 * should ever have this full URL.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const expected = process.env.DECODO_WEBHOOK_TOKEN?.trim();
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const eventName = String((body as Record<string, unknown>).event_name ?? "unknown");
  const usageRaw = (body as Record<string, unknown>).usage;
  const usagePercent = typeof usageRaw === "string" ? Number(usageRaw.replace("%", "")) : null;

  await saveDecodoWebhookEvent({
    eventName,
    usagePercent: Number.isFinite(usagePercent) ? (usagePercent as number) : null,
    username: ((body as Record<string, unknown>).username as string) ?? null,
    dateTime: ((body as Record<string, unknown>).date_time as string) ?? null,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
