import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { touchSession } from "@/lib/demo-store";
import { sameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return NextResponse.json({ error: "คำขอมาจากเว็บไซต์อื่น" }, { status: 403 });
  const token = (await cookies()).get("sisat_demo_session")?.value;
  const active = await touchSession(token);
  if (!active) return NextResponse.json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}