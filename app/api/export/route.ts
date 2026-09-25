import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser, hasRole, readData } from "@/lib/demo-store";
import { exportCustomerCsv } from "@/lib/export-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const data = await readData();
  const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
  if (!me || hasRole(me, "customer")) return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งออกข้อมูล" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const csv = exportCustomerCsv(data, {
    customerId: params.get("customerId")?.slice(0, 80) || undefined,
    category: params.get("category")?.slice(0, 60) || undefined,
    productId: params.get("productId")?.slice(0, 80) || undefined,
    status: params.get("status")?.slice(0, 30) || undefined,
    query: params.get("q")?.slice(0, 100) || undefined,
  });
  return new NextResponse(csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="sisat90-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
