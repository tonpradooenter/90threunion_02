import { NextResponse } from "next/server";
import { readData } from "@/lib/demo-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await readData();
    return NextResponse.json({ status: "ok", version: "1.0.0" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
