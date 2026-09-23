import { NextResponse } from "next/server";
import { fetchZyteUsage } from "@/lib/providers/zyte";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchZyteUsage();
  return NextResponse.json(result);
}
