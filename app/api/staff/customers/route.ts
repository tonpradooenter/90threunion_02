import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser, hasRole, readData } from "@/lib/demo-store";
import { searchDatabaseCustomers } from "@/lib/database-store";
import { databaseProvider } from "@/lib/database-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const data = await readData();
  const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
  if (!me || hasRole(me, "customer")) return NextResponse.json({ error: "ไม่มีสิทธิ์ค้นหาลูกค้า" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(0, Math.min(1000, Number.parseInt(params.get("page") ?? "0", 10) || 0));
  const customers = databaseProvider() !== "file"
    ? await searchDatabaseCustomers(query, 50, page * 50)
    : data.users.filter((user) => hasRole(user, "customer") && user.active && [user.displayName, user.username, user.phone ?? "", user.id].some((value) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase())))
      .slice(page * 50, page * 50 + 50).map((user) => ({ id: user.id, displayName: user.displayName, username: user.username, phone: user.phone, orderCount: data.orders.filter((order) => order.userId === user.id).length }));
  return NextResponse.json({ customers, page }, { headers: { "Cache-Control": "private, no-store" } });
}
