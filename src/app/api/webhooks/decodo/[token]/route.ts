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

/**
 * Pull the usage percentage out of a Decodo webhook body.
 *
 * Decodo publishes no payload schema, so this accepts the plausible shapes
 * rather than one guessed field. The original version only handled a string
 * like "80%"; the first real event (2026-10-06) did not match and was stored as
 * null, which showed on the dashboard as "usage ?%" with the figure lost.
 *
 * Returns null when nothing usable is found — the raw body is stored alongside
 * so the actual shape can be read off the UI instead of guessed again.
 */
function extractPercent(obj: Record<string, unknown>): number | null {
  const KEYS = ["usage", "usage_percent", "usagePercent", "percent", "percentage", "threshold", "value"];
  for (const k of KEYS) {
    const v = obj[k];
    let n: number | null = null;
    if (typeof v === "number") n = v;
    // Strings may carry a % sign or spaces: "80%", " 80 ".
    else if (typeof v === "string" && v.trim() !== "") n = Number(v.replace("%", "").trim());
    if (n != null && Number.isFinite(n) && n >= 0 && n <= 100) return n;
  }
  return null;
}

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

  const obj = body as Record<string, unknown>;
  const eventName = String(obj.event_name ?? obj.eventName ?? "unknown");

  await saveDecodoWebhookEvent({
    eventName,
    usagePercent: extractPercent(obj),
    username: (obj.username as string) ?? null,
    dateTime: (obj.date_time as string) ?? (obj.dateTime as string) ?? null,
    receivedAt: new Date().toISOString(),
    raw: body,
  });

  return NextResponse.json({ ok: true });
}
