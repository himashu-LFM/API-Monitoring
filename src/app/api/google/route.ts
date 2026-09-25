import { NextResponse } from "next/server";
import { fetchGoogleUsage } from "@/lib/providers/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchGoogleUsage();
  return NextResponse.json(result);
}
