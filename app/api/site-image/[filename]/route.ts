import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const imageDir = path.join(process.cwd(), "data", "site-images");

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }): Promise<NextResponse> {
  const { filename } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/.test(filename))
    return NextResponse.json({ error: "ไม่พบภาพ" }, { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(imageDir, filename));
    const mime = filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "Content-Type": mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return NextResponse.json({ error: "ไม่พบภาพ" }, { status: 404 });
    return NextResponse.json({ error: "อ่านภาพไม่สำเร็จ" }, { status: 500 });
  }
}