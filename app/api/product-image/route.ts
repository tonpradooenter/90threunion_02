import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser, hasRole, readData } from "@/lib/demo-store";
import sharp from "sharp";
import { storagePath } from "@/lib/storage";
import { sameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "คำขอมาจากเว็บไซต์อื่น" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 5 MB" }, { status: 413 });
    const data = await readData();
    const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
    if (!me || (!hasRole(me, "merch") && !hasRole(me, "superadmin"))) return NextResponse.json({ error: "ไม่มีสิทธิ์เปลี่ยนรูปสินค้า" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 20 || file.size > 5_000_000) return NextResponse.json({ error: "เลือกภาพขนาดไม่เกิน 5 MB" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    let extension = "";
    if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) extension = "png";
    else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) extension = "jpg";
    else if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") extension = "webp";
    if (!extension) return NextResponse.json({ error: "รองรับเฉพาะ PNG, JPG หรือ WebP" }, { status: 400 });
    const filename = `${randomUUID()}.${extension}`;
    const meta = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.width || !meta.height || !["png", "jpeg", "webp"].includes(meta.format ?? "")) return NextResponse.json({ error: "ไฟล์ภาพไม่ถูกต้อง" }, { status: 400 });
    const directory = storagePath("product-images");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ ok: true, path: `/api/product-image/${filename}` });
  } catch (error) {
    console.error("Product image upload error", error);
    return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 500 });
  }
}
