import { NextResponse } from "next/server";
import { fetchAnthropicUsage } from "@/lib/providers/anthropic";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchAnthropicUsage();
  return NextResponse.json(result);
}
