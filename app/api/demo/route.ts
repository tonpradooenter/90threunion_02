import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { activeOrder, currentUser, hasRole, hashPassword, logAction, mutateData, publicUser, readData, snapshot, verifyPassword } from "@/lib/demo-store";
import { sameOrigin } from "@/lib/request-origin";
import type { DemoData, DemoOrder, DemoUser, OrderItem, Role } from "@/lib/demo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "sisat_demo_session";
const roles: Role[] = ["superadmin", "tables", "merch", "finance", "gate", "customer"];

function cookieSecure(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return process.env.NODE_ENV === "production" && !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function requireUser(data: DemoData, token: string | undefined): DemoUser {
  const user = currentUser(data, token);
  if (!user) throw new AppError("กรุณาเข้าสู่ระบบก่อน", 401);
  return user;
}

function requireRole(user: DemoUser, allowed: Role[]): void {
  if (!allowed.some((role) => hasRole(user, role))) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ทำรายการ", 403);
}

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function int(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new AppError("ตัวเลขไม่ถูกต้อง");
  return number;
}

function productUsed(data: DemoData, productId: string, ignoreOrderId?: string): number {
  return data.orders.filter((order) => order.id !== ignoreOrderId && activeOrder(order)).flatMap((order) => order.items)
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function selection(data: DemoData, body: Record<string, unknown>, type: "table" | "product", ignoreOrderId?: string) {
  const tableIds = type === "table" && Array.isArray(body.tableIds) ? body.tableIds.map((v) => str(v, 8).toUpperCase()) : [];
  const requested = type === "product" && Array.isArray(body.items) ? body.items as { productId?: unknown; quantity?: unknown; size?: unknown }[] : [];
  const items: OrderItem[] = [];
  const requestedQuantity = new Map<string, number>();
  let amount = 0;
  if (type === "table") {
    if (!tableIds.length || tableIds.length > 6 || new Set(tableIds).size !== tableIds.length) throw new AppError("เลือกได้ครั้งละ 1–6 โต๊ะ");
    for (const id of tableIds) {
      const match = /^([A-J])-(0[1-9]|[1-5][0-9]|60)$/.exec(id);
      if (!match) throw new AppError("หมายเลขโต๊ะไม่ถูกต้อง");
      if (data.blockedTables.includes(id) || data.orders.some((order) => order.id !== ignoreOrderId && activeOrder(order) && order.tableIds.includes(id))) throw new AppError(`โต๊ะ ${id} ถูกจองแล้ว กรุณาเลือกใหม่`);
      amount += data.zones.find((zone) => zone.id === match[1])?.price ?? 0;
    }
  } else {
    if (!requested.length || requested.length > 20) throw new AppError("กรุณาเลือกสินค้า");
    for (const entry of requested) {
      const product = data.products.find((p) => p.id === str(entry.productId, 80) && p.active);
      if (!product) throw new AppError("ไม่พบสินค้า");
      const quantity = int(entry.quantity, 1, 20);
      const size = str(entry.size, 20);
      if (product.sizes.length && !product.sizes.includes(size)) throw new AppError(`กรุณาเลือกไซซ์ของ ${product.name}`);
      const cumulative = (requestedQuantity.get(product.id) ?? 0) + quantity;
      if (product.stock - productUsed(data, product.id, ignoreOrderId) < cumulative) throw new AppError(`${product.name} เหลือไม่พอ`);
      requestedQuantity.set(product.id, cumulative);
      items.push({ productId: product.id, name: product.name, quantity, unitPrice: product.price, ...(size ? { size } : {}) });
      amount += product.price * quantity;
    }
  }
  return { tableIds, items, amount };
}

function responseError(error: unknown): NextResponse {
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Demo API error", error);
  return NextResponse.json({ error: "ระบบสาธิตขัดข้อง กรุณาลองอีกครั้ง" }, { status: 500 });
}

export async function GET(): Promise<NextResponse> {
  try {
    const data = await readData();
    const token = (await cookies()).get(COOKIE)?.value;
    const response = NextResponse.json(snapshot(data, currentUser(data, token)));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) throw new AppError("คำขอมาจากเว็บไซต์อื่น", 403);
    if (Number(request.headers.get("content-length") ?? 0) > 100_000) throw new AppError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
    const body = await request.json() as Record<string, unknown>;
    const action = str(body.action, 40);
    const token = (await cookies()).get(COOKIE)?.value;

    if (action === "login") {
      const username = str(body.username, 80).toLowerCase();
      const password = str(body.password, 200);
      const sessionToken = randomBytes(32).toString("hex");
      const user = await mutateData((data) => {
        const found = data.users.find((entry) => entry.username === username && entry.active);
        if (!found || !verifyPassword(password, found.passwordHash)) throw new AppError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
        data.sessions.push({ token: sessionToken, userId: found.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
        return publicUser(found);
      });
      const response = NextResponse.json({ ok: true, user });
      response.cookies.set(COOKIE, sessionToken, { httpOnly: true, sameSite: "strict", secure: cookieSecure(request), path: "/", maxAge: 12 * 60 * 60 });
      return response;
    }

    if (action === "register") {
      const username = str(body.username, 40).toLowerCase();
      const displayName = str(body.displayName, 80);
      const password = str(body.password, 200);
      if (!/^[a-z0-9_.]{4,40}$/.test(username)) throw new AppError("ชื่อผู้ใช้ต้องมี 4–40 ตัว ใช้อักษรอังกฤษ ตัวเลข จุด หรือ _");
      if (displayName.length < 2 || password.length < 8) throw new AppError("กรุณากรอกชื่อและรหัสผ่านอย่างน้อย 8 ตัว");
      const sessionToken = randomBytes(32).toString("hex");
      const user = await mutateData((data) => {
        if (data.users.some((entry) => entry.username === username)) throw new AppError("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
        const created: DemoUser = { id: randomUUID(), username, displayName, passwordHash: hashPassword(password), role: "customer", roles: ["customer"], contactSource: "web", active: true, createdAt: new Date().toISOString() };
        data.users.push(created);
        data.sessions.push({ token: sessionToken, userId: created.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
        logAction(data, created.id, "register", username);
        return publicUser(created);
      });
      const response = NextResponse.json({ ok: true, user });
      response.cookies.set(COOKIE, sessionToken, { httpOnly: true, sameSite: "strict", secure: cookieSecure(request), path: "/", maxAge: 12 * 60 * 60 });
      return response;
    }

    if (action === "logout") {
      await mutateData((data) => { data.sessions = data.sessions.filter((entry) => entry.token !== token); });
      const response = NextResponse.json({ ok: true });
      response.cookies.delete(COOKIE);
      return response;
    }

    const result = await mutateData((data) => {
      const me = requireUser(data, token);

      if (action === "createOrder") {
        requireRole(me, ["customer", "superadmin"]);
        const type = body.type === "table" ? "table" : body.type === "product" ? "product" : null;
        if (!type) throw new AppError("ประเภทคำสั่งซื้อไม่ถูกต้อง");
        const { tableIds, items, amount } = selection(data, body, type);
        const now = new Date();
        const order: DemoOrder = {
          id: `SR90-${now.getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`,
          userId: me.id, type, status: "awaiting_slip", tableIds, items,
          meal: type === "table" ? str(body.meal, 100) || "ชุดอาหารมาตรฐาน" : "",
          dietaryNotes: type === "table" ? str(body.dietaryNotes, 500) : "",
          amount, createdAt: now.toISOString(), holdUntil: new Date(now.getTime() + 20 * 60 * 1000).toISOString(),
          ticketCodes: [], checkedInCodes: [],
        };
        data.orders.unshift(order);
        logAction(data, me.id, "create_order", order.id);
        return { order };
      }

      if (action === "createCustomer") {
        requireRole(me, ["superadmin", "tables", "merch"]);
        const username = str(body.username, 40).toLowerCase();
        const displayName = str(body.displayName, 80);
        const password = str(body.password, 200);
        const phone = str(body.phone, 30);
        const source = str(body.contactSource, 20);
        if (!/^[a-z0-9_.]{4,40}$/.test(username)) throw new AppError("ชื่อผู้ใช้ต้องมี 4–40 ตัว ใช้อักษรอังกฤษ ตัวเลข จุด หรือ _");
        if (displayName.length < 2 || password.length < 8) throw new AppError("กรุณากรอกชื่อและรหัสผ่านอย่างน้อย 8 ตัว");
        if (phone && !/^[0-9+() -]{8,30}$/.test(phone)) throw new AppError("เบอร์โทรศัพท์ไม่ถูกต้อง");
        if (!["phone", "line", "walkin"].includes(source)) throw new AppError("กรุณาเลือกช่องทางติดต่อ");
        if (data.users.some((entry) => entry.username === username)) throw new AppError("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
        if (phone && data.users.some((entry) => entry.phone === phone)) throw new AppError("เบอร์โทรนี้มีบัญชีแล้ว กรุณาค้นหาบัญชีเดิม");
        const customer: DemoUser = { id: randomUUID(), username, displayName, role: "customer", roles: ["customer"], phone, contactSource: source as DemoUser["contactSource"], passwordHash: hashPassword(password), active: true, createdAt: new Date().toISOString() };
        data.users.push(customer);
        logAction(data, me.id, "create_customer", `${username} (${source})`);
        return { customer: publicUser(customer) };
      }

      if (action === "createAssistedOrder" || action === "updateAssistedOrder") {
        const existing = action === "updateAssistedOrder" ? data.orders.find((entry) => entry.id === str(body.orderId, 60)) : undefined;
        if (action === "updateAssistedOrder" && !existing) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        const type = existing?.type ?? (body.type === "table" ? "table" : body.type === "product" ? "product" : null);
        if (!type) throw new AppError("ประเภทคำสั่งซื้อไม่ถูกต้อง");
        requireRole(me, type === "table" ? ["superadmin", "tables"] : ["superadmin", "merch"]);
        if (existing && !["assisted_draft", "awaiting_slip", "needs_revision"].includes(existing.status)) throw new AppError("รายการที่ส่งตรวจหรืออนุมัติแล้วแก้ไขไม่ได้");
        const customer = data.users.find((entry) => entry.id === (existing?.userId ?? str(body.userId, 80)) && entry.active && hasRole(entry, "customer"));
        if (!customer) throw new AppError("ไม่พบบัญชีลูกค้า", 404);
        const { tableIds, items, amount } = selection(data, body, type, existing?.id);
        const now = new Date();
        const channel = str(body.channel, 20);
        if (!["phone", "line", "walkin"].includes(channel)) throw new AppError("กรุณาเลือกช่องทางที่ลูกค้าติดต่อ");
        const summary = existing ? `เจ้าหน้าที่แก้ไขรายการ ยอดเดิม ฿${existing.amount} → ฿${amount}` : `เจ้าหน้าที่รับรายการทาง ${channel}`;
        const order: DemoOrder = existing ?? {
          id: `SR90-${now.getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`,
          userId: customer.id, type, status: "assisted_draft", tableIds: [], items: [], meal: "", dietaryNotes: "", amount: 0,
          createdAt: now.toISOString(), holdUntil: "", ticketCodes: [], checkedInCodes: [], history: [],
        };
        order.tableIds = tableIds;
        order.items = items;
        order.amount = amount;
        order.meal = type === "table" ? str(body.meal, 100) || "ชุดอาหารมาตรฐาน" : "";
        order.dietaryNotes = type === "table" ? str(body.dietaryNotes, 500) : "";
        order.status = "assisted_draft";
        order.holdUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        order.channel = channel as DemoOrder["channel"];
        order.assistedBy = me.id;
        order.slipFile = undefined;
        order.slipName = undefined;
        order.financeComment = undefined;
        order.reviewedBy = undefined;
        order.reviewedAt = undefined;
        order.history = [...(order.history ?? []), { at: now.toISOString(), actor: me.displayName, summary }];
        if (!existing) data.orders.unshift(order);
        logAction(data, me.id, existing ? "update_assisted_order" : "create_assisted_order", `${order.id} → ${customer.username}: ${summary}`);
        return { order };
      }

      if (action === "cancelAssistedOrder") {
        const order = data.orders.find((entry) => entry.id === str(body.orderId, 60));
        if (!order) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        requireRole(me, order.type === "table" ? ["superadmin", "tables"] : ["superadmin", "merch"]);
        if (!["assisted_draft", "awaiting_slip", "needs_revision"].includes(order.status)) throw new AppError("รายการที่ส่งตรวจหรืออนุมัติแล้วต้องให้ฝ่ายการเงินดำเนินการ");
        const reason = str(body.reason, 200);
        if (reason.length < 3) throw new AppError("กรุณาระบุเหตุผลการยกเลิก");
        order.status = "cancelled";
        order.history = [...(order.history ?? []), { at: new Date().toISOString(), actor: me.displayName, summary: `ยกเลิก: ${reason}` }];
        logAction(data, me.id, "cancel_assisted_order", `${order.id}: ${reason}`);
        return { order };
      }

      if (action === "cancelOrder") {
        const order = data.orders.find((entry) => entry.id === str(body.orderId, 60));
        if (!order) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        if (order.userId !== me.id && !hasRole(me, "superadmin")) throw new AppError("ไม่มีสิทธิ์ยกเลิก", 403);
        if (order.status === "approved") throw new AppError("รายการที่อนุมัติแล้วต้องติดต่อเจ้าหน้าที่");
        order.status = "cancelled";
        logAction(data, me.id, "cancel_order", order.id);
        return { order };
      }

      if (action === "reviewOrder") {
        requireRole(me, ["superadmin", "finance"]);
        const order = data.orders.find((entry) => entry.id === str(body.orderId, 60));
        if (!order) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        if (order.status !== "under_review") throw new AppError("รายการนี้ยังไม่มีสลิปที่รอตรวจ");
        const decision = str(body.decision, 20);
        if (decision !== "approve" && decision !== "revise") throw new AppError("ผลการตรวจไม่ถูกต้อง");
        const comment = str(body.comment, 400);
        if (decision === "revise" && comment.length < 4) throw new AppError("กรุณาระบุเหตุผลให้ลูกค้าทราบ");
        order.status = decision === "approve" ? "approved" : "needs_revision";
        order.financeComment = comment;
        order.reviewedBy = me.id;
        order.reviewedAt = new Date().toISOString();
        if (decision === "approve") {
          if (order.type === "table") order.ticketCodes = order.tableIds.flatMap((id) => Array.from({ length: 8 }, (_, index) => `${id}-${index + 1}-${randomBytes(2).toString("hex").toUpperCase()}`));
          else order.pickupCode = `PICK-${randomBytes(4).toString("hex").toUpperCase()}`;
        }
        logAction(data, me.id, decision === "approve" ? "approve_order" : "request_revision", order.id);
        return { order };
      }

      if (action === "saveProduct") {
        requireRole(me, ["superadmin", "merch"]);
        const id = str(body.id, 80);
        const existing = data.products.find((entry) => entry.id === id);
        const name = str(body.name, 100);
        const description = str(body.description, 400);
        const price = int(body.price, 0, 1_000_000);
        const stock = int(body.stock, 0, 1_000_000);
        const image = str(body.image, 300);
        if (name.length < 2) throw new AppError("กรุณาใส่ชื่อสินค้า");
        if (image && !/^\/(assets|uploads)\/[a-zA-Z0-9._/-]+$/.test(image)) throw new AppError("ตำแหน่งรูปภาพไม่ถูกต้อง");
        const used = existing ? productUsed(data, existing.id) : 0;
        if (stock < used) throw new AppError(`สต็อกต่ำกว่าจำนวนที่จอง/ขายแล้ว (${used})`);
        const product = {
          id: existing?.id ?? randomUUID(), name, description, price, stock,
          image: image || "/assets/souvenir-unbranded.png", category: str(body.category, 60) || "ของที่ระลึก",
          sizes: Array.isArray(body.sizes) ? body.sizes.map((s) => str(s, 15)).filter(Boolean).slice(0, 10) : existing?.sizes ?? [],
          active: body.active !== false,
        };
        if (existing) Object.assign(existing, product); else data.products.push(product);
        logAction(data, me.id, "save_product", product.name);
        return { product };
      }

      if (action === "saveZone") {
        requireRole(me, ["superadmin", "tables"]);
        const zone = data.zones.find((entry) => entry.id === str(body.id, 1));
        if (!zone) throw new AppError("ไม่พบโซน");
        zone.price = int(body.price, 0, 1_000_000);
        logAction(data, me.id, "save_zone_price", `${zone.id}: ${zone.price}`);
        return { zone };
      }

      if (action === "setRoles" || action === "setRole") {
        requireRole(me, ["superadmin"]);
        const target = data.users.find((entry) => entry.id === str(body.userId, 80));
        const assigned = (Array.isArray(body.roles) ? body.roles : [body.role]).map((value) => str(value, 20) as Role);
        if (!target || !assigned.length || assigned.length > 5 || new Set(assigned).size !== assigned.length || assigned.some((role) => !roles.includes(role))) throw new AppError("ข้อมูลผู้ใช้หรือบทบาทไม่ถูกต้อง");
        if ((assigned.includes("customer") || assigned.includes("superadmin")) && assigned.length !== 1) throw new AppError("ลูกค้าและผู้ดูแลระบบหลักต้องเป็นบทบาทเดี่ยว");
        if (target.id === me.id && !assigned.includes("superadmin")) throw new AppError("ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งาน");
        target.roles = assigned;
        target.role = assigned[0];
        logAction(data, me.id, "set_roles", `${target.username}: ${assigned.join(", ")}`);
        return { user: publicUser(target) };
      }

      if (action === "scanTicket") {
        requireRole(me, ["superadmin", "gate"]);
        const code = str(body.code, 100).toUpperCase();
        const order = data.orders.find((entry) => entry.status === "approved" && (entry.ticketCodes.includes(code) || entry.pickupCode === code));
        if (!order) throw new AppError("ไม่พบตั๋วที่อนุมัติแล้ว", 404);
        if (order.pickupCode === code) {
          if (order.pickedUpAt) throw new AppError("รับสินค้าไปแล้ว");
          order.pickedUpAt = new Date().toISOString();
        } else {
          if (order.checkedInCodes.includes(code)) throw new AppError("ตั๋วใบนี้ใช้เข้างานแล้ว");
          order.checkedInCodes.push(code);
        }
        logAction(data, me.id, "scan_ticket", code);
        return { order, message: order.pickupCode === code ? "บันทึกรับสินค้าแล้ว" : "บันทึกเข้างานแล้ว" };
      }

      throw new AppError("ไม่รู้จักคำสั่ง", 404);
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) { return responseError(error); }
}
