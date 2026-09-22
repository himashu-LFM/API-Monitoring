import { NextResponse } from "next/server";
import { getAllStatuses } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const services = await getAllStatuses();
  return NextResponse.json({ services, fetchedAt: new Date().toISOString() });
}
