import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { storagePath } from "@/lib/storage";
import { currentUser, hasRole, readData } from "@/lib/demo-store";
import { sameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
const imageDir = storagePath("site-images");
const guidance = {
  eventLogo: { minWidth: 256, minHeight: 256, transparent: true },
  ovcLogo: { minWidth: 256, minHeight: 256, transparent: true },
  heroDesktop: { minWidth: 1200, minHeight: 600, transparent: false },
  heroMobile: { minWidth: 600, minHeight: 800, transparent: false },
  introImage: { minWidth: 800, minHeight: 550, transparent: false },
  tableBanner: { minWidth: 800, minHeight: 450, transparent: false },
  shopBanner: { minWidth: 800, minHeight: 450, transparent: false },
  closingImage: { minWidth: 1200, minHeight: 500, transparent: false },
} as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "คำขอมาจากเว็บไซต์อื่น" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return NextResponse.json({ error: "ภาพใหญ่เกิน 5 MB" }, { status: 413 });
    const data = await readData();
    const me = currentUser(data, (await cookies()).get("sisat_demo_session")?.value);
    if (!me || !hasRole(me, "superadmin")) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบหลัก" }, { status: 403 });
    const form = await request.formData();
    const slot = String(form.get("slot") ?? "") as keyof typeof guidance;
    const file = form.get("file");
    const rule = guidance[slot];
    if (!rule || !(file instanceof File) || file.size < 100 || file.size > 5_000_000) return NextResponse.json({ error: "เลือกภาพ PNG/JPG/WebP ขนาดไม่เกิน 5 MB" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format ?? "") || !meta.width || !meta.height) return NextResponse.json({ error: "ชนิดภาพไม่ถูกต้อง" }, { status: 400 });
    if (meta.width < rule.minWidth || meta.height < rule.minHeight || meta.width > 6000 || meta.height > 6000) return NextResponse.json({ error: `ภาพนี้ควรมีขนาดอย่างน้อย ${rule.minWidth}×${rule.minHeight} และไม่เกิน 6000×6000 พิกเซล` }, { status: 400 });
    if (rule.transparent && (!["png", "webp"].includes(meta.format ?? "") || !meta.hasAlpha)) return NextResponse.json({ error: "โลโก้ต้องเป็น PNG/WebP พื้นหลังโปร่งใส" }, { status: 400 });
    const ext = meta.format === "jpeg" ? "jpg" : meta.format;
    const filename = `${randomUUID()}.${ext}`;
    await fs.mkdir(imageDir, { recursive: true });
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ imageDir, filename), bytes, { flag: "wx" });
    return NextResponse.json({ ok: true, path: `/api/site-image/${filename}`, width: meta.width, height: meta.height });
  } catch (error) {
    console.error("Site image upload error", error);
    return NextResponse.json({ error: "ตรวจภาพหรืออัปโหลดไม่สำเร็จ" }, { status: 500 });
  }
}