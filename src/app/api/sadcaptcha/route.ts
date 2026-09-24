import { NextResponse } from "next/server";
import { fetchSadCaptchaUsage } from "@/lib/providers/sadcaptcha";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchSadCaptchaUsage();
  return NextResponse.json(result);
}
