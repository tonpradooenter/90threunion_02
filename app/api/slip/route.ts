import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser, hasRole, logAction, mutateData, readData } from "@/lib/demo-store";
import { sameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slipDir = path.join(process.cwd(), "data", "slips");

function fileType(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { extension: "png", mime: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") return { extension: "webp", mime: "image/webp" };
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "คำขอมาจากเว็บไซต์อื่น" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 5 MB" }, { status: 413 });
    const data = await readData();
    const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
    if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    const orderId = String(form.get("orderId") ?? "").slice(0, 60);
    if (!(file instanceof File) || file.size < 20 || file.size > 5_000_000) return NextResponse.json({ error: "เลือกภาพสลิปขนาดไม่เกิน 5 MB" }, { status: 400 });
    const existing = data.orders.find((order) => order.id === orderId && order.userId === me.id);
    if (!existing || !["awaiting_slip", "assisted_draft", "needs_revision"].includes(existing.status)) return NextResponse.json({ error: "รายการนี้อัปโหลดสลิปไม่ได้" }, { status: 400 });
    if (["awaiting_slip", "assisted_draft"].includes(existing.status) && Date.parse(existing.holdUntil) < Date.now()) return NextResponse.json({ error: "หมดเวลาจอง กรุณาเลือกใหม่" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = fileType(bytes);
    if (!type) return NextResponse.json({ error: "รองรับเฉพาะ PNG, JPG หรือ WebP" }, { status: 400 });
    const filename = `${randomUUID()}.${type.extension}`;
    await fs.mkdir(slipDir, { recursive: true });
    await fs.writeFile(path.join(slipDir, filename), bytes, { flag: "wx" });
    await mutateData((latest) => {
      const order = latest.orders.find((entry) => entry.id === orderId && entry.userId === me.id);
      if (!order || !["awaiting_slip", "assisted_draft", "needs_revision"].includes(order.status)) throw new Error("Order state changed");
      order.slipFile = filename;
      order.slipName = file.name.slice(0, 150);
      order.status = "under_review";
      order.financeComment = "";
      logAction(latest, me.id, "upload_slip", order.id);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slip upload error", error);
    return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const data = await readData();
    const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
    if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
    const order = data.orders.find((entry) => entry.id === orderId);
    if (!order || !order.slipFile) return NextResponse.json({ error: "ไม่พบสลิป" }, { status: 404 });
    if (order.userId !== me.id && !hasRole(me, "finance") && !hasRole(me, "superadmin")) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูสลิป" }, { status: 403 });
    const file = await fs.readFile(path.join(slipDir, path.basename(order.slipFile)));
    const mime = order.slipFile.endsWith(".png") ? "image/png" : order.slipFile.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": mime, "Content-Disposition": `inline; filename="slip.${order.slipFile.split(".").at(-1)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Slip read error", error);
    return NextResponse.json({ error: "อ่านสลิปไม่สำเร็จ" }, { status: 500 });
  }
}
