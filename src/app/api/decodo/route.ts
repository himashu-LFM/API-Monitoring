import { NextResponse } from "next/server";
import { fetchDecodoUsage } from "@/lib/providers/decodo";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchDecodoUsage();
  return NextResponse.json(result);
}
