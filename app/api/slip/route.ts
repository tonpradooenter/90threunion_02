import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { currentUser, hasRole, logAction, mutateData, readData } from "@/lib/demo-store";
import { sameOrigin } from "@/lib/request-origin";
import { storagePath } from "@/lib/storage";
import type { SlipImage } from "@/lib/demo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const slipDir = storagePath("slips");
const maxFileBytes = 5_000_000;

function fileType(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { extension: "png", mime: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") return { extension: "webp", mime: "image/webp" };
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const written: string[] = [];
  let committed = false;
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "คำขอมาจากเว็บไซต์อื่น" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 16_000_000) return NextResponse.json({ error: "รวมภาพสลิปใหญ่เกิน 15 MB" }, { status: 413 });
    const data = await readData();
    const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
    if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const form = await request.formData();
    const files = [...form.getAll("files"), ...form.getAll("file")];
    const orderId = String(form.get("orderId") ?? "").slice(0, 60);
    if (!files.length || files.length > 3 || files.some((file) => !(file instanceof File) || file.size < 20 || file.size > maxFileBytes)) {
      return NextResponse.json({ error: "เลือกภาพสลิปไม่เกิน 3 รูป รูปละไม่เกิน 5 MB" }, { status: 400 });
    }
    const existing = data.orders.find((order) => order.id === orderId && order.userId === me.id);
    if (!existing || !["awaiting_slip", "assisted_draft", "needs_revision", "under_review"].includes(existing.status)) {
      return NextResponse.json({ error: "รายการนี้อัปโหลดสลิปไม่ได้" }, { status: 400 });
    }
    if (existing.status !== "under_review" && Date.parse(existing.holdUntil) <= Date.now()) {
      return NextResponse.json({ error: "หมดเวลาส่งสลิป กรุณาติดต่อเจ้าหน้าที่หรือเลือกใหม่" }, { status: 400 });
    }
    const replace = existing.status === "needs_revision";
    if (!replace && (existing.slips?.length ?? 0) + files.length > 3) return NextResponse.json({ error: "ออเดอร์นี้มีสลิปครบ 3 รูปแล้ว" }, { status: 400 });
    const incoming: SlipImage[] = [];
    await fs.mkdir(slipDir, { recursive: true });
    for (const file of files as File[]) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = fileType(bytes);
      if (!type) return NextResponse.json({ error: "รองรับเฉพาะ PNG, JPG หรือ WebP" }, { status: 400 });
      const meta = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
      if (!meta.width || !meta.height || meta.width > 9000 || meta.height > 9000) return NextResponse.json({ error: "ไฟล์ภาพสลิปไม่ถูกต้อง" }, { status: 400 });
      const filename = `${randomUUID()}.${type.extension}`;
      await fs.writeFile(path.join(/*turbopackIgnore: true*/ slipDir, filename), bytes, { flag: "wx" });
      written.push(filename);
      incoming.push({ id: randomUUID(), filename, name: file.name.slice(0, 150), uploadedAt: new Date().toISOString() });
    }
    const oldFiles = await mutateData((latest) => {
      const order = latest.orders.find((entry) => entry.id === orderId && entry.userId === me.id);
      if (!order || !["awaiting_slip", "assisted_draft", "needs_revision", "under_review"].includes(order.status)) throw new Error("Order state changed");
      if (order.status !== "under_review" && Date.parse(order.holdUntil) <= Date.now()) throw new Error("Deadline passed");
      const replacing = order.status === "needs_revision";
      const previous = replacing ? (order.slips ?? []).map((entry) => entry.filename) : [];
      if (!replacing && (order.slips?.length ?? 0) + incoming.length > 3) throw new Error("Slip limit reached");
      order.slips = replacing ? incoming : [...(order.slips ?? []), ...incoming];
      order.slipFile = order.slips[0]?.filename;
      order.slipName = order.slips[0]?.name;
      order.status = "under_review";
      order.financeComment = "";
      logAction(latest, me.id, "upload_slip", `${order.id}: ${incoming.length} images`);
      return previous;
    });
    committed = true;
    for (const filename of oldFiles) await fs.unlink(path.join(slipDir, path.basename(filename))).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slip upload error", error);
    return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  } finally {
    if (!committed) for (const filename of written) await fs.unlink(path.join(/*turbopackIgnore: true*/ slipDir, filename)).catch(() => undefined);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const data = await readData();
    const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
    if (!me) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const orderId = params.get("orderId") ?? "";
    const slipId = params.get("slipId") ?? "";
    const order = data.orders.find((entry) => entry.id === orderId);
    if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
    if (order.userId !== me.id && !hasRole(me, "finance") && !hasRole(me, "superadmin")) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูสลิป" }, { status: 403 });
    const images = order.slips?.length ? order.slips : order.slipFile ? [{ id: order.slipFile, filename: order.slipFile }] : [];
    const slip = slipId ? images.find((entry) => entry.id === slipId) : images[0];
    if (!slip) return NextResponse.json({ error: "ไม่พบสลิป" }, { status: 404 });
    const filename = path.basename(slip.filename);
    const file = await fs.readFile(path.join(/*turbopackIgnore: true*/ slipDir, filename));
    const mime = filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(file), { headers: {
      "Content-Type": mime, "Content-Disposition": `inline; filename="slip.${filename.split(".").at(-1)}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Slip read error", error);
    return NextResponse.json({ error: "อ่านสลิปไม่สำเร็จ" }, { status: 500 });
  }
}