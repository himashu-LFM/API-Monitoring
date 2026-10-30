import { NextResponse } from "next/server";
import { runUsageCheck } from "@/lib/alert-checker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Usage-threshold checker, meant to be called on a schedule (GitHub Actions
 * cron / Vercel cron). Protected by CRON_SECRET so a public deployment can't
 * be poked by anyone — send it as `Authorization: Bearer <secret>` or `?key=`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const url = new URL(req.url);
    const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Optional one-shot re-arm: ?rearm=zyte (or a comma-separated list) clears
  // those services' dedup for this run so a suppressed alert fires once. Still
  // behind CRON_SECRET above, so it isn't publicly callable.
  const rearm = new URL(req.url).searchParams.get("rearm");
  const result = await runUsageCheck(rearm ? { rearm: rearm.split(",") } : undefined);
  return NextResponse.json(result);
}
