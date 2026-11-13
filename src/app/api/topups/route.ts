import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readTopups, saveTopup } from "@/lib/topups";

export const dynamic = "force-dynamic";

/**
 * Record a Zyte limit or a Decodo renewal date from the dashboard instead of
 * editing env vars and redeploying. Admin-only: the middleware only requires a
 * login for /api routes, so the role is checked here.
 */
async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await readTopups());
}

function positive(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isoDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const service = body?.service;
  const at = new Date().toISOString();

  if (service === "zyte") {
    const limit = positive(body?.limit);
    if (limit == null) return NextResponse.json({ error: "limit must be a positive USD amount" }, { status: 400 });
    await saveTopup("zyte", { limit, at });
  } else if (service === "decodo") {
    const renewal = isoDate(body?.renewal);
    if (renewal == null) return NextResponse.json({ error: "renewal must be a date (yyyy-mm-dd)" }, { status: 400 });
    await saveTopup("decodo", { renewal, at });
  } else {
    return NextResponse.json({ error: "service must be zyte or decodo" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, topups: await readTopups() });
}
