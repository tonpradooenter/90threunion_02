import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { activeOrder, currentUser, hasRole, hashPassword, logAction, mutateData, publicUser, readData, snapshot, verifyPassword, visibleOrder } from "@/lib/demo-store";
import { sameOrigin } from "@/lib/request-origin";
import { cancelEntireOrder, completeRefund, orderIsUsed, recordRemovedSelections, resolveCancellation } from "@/lib/order-workflow";
import { defaultBranding, settingsOf, validSiteImage } from "@/lib/site-settings";
import type { DemoData, DemoOrder, DemoUser, OrderItem, OrderRefund, Role } from "@/lib/demo-types";

import { loginAllowed } from "@/lib/login-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "sisat_demo_session";
const roles: Role[] = ["superadmin", "tables", "merch", "finance", "gate", "customer"];

function cookieSecure(request: Request): boolean {
  const hostname = new URL(process.env.APP_ORIGIN || request.url).hostname;
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

function selection(data: DemoData, body: Record<string, unknown>, type: "table" | "product", ignoreOrderId?: string, allowEmpty = false) {
  const existing = ignoreOrderId ? data.orders.find((order) => order.id === ignoreOrderId) : undefined;
  const tableIds = type === "table" && Array.isArray(body.tableIds) ? body.tableIds.map((v) => str(v, 8).toUpperCase()) : [];
  const requested = type === "product" && Array.isArray(body.items) ? body.items as { id?: unknown; productId?: unknown; quantity?: unknown; optionId?: unknown; size?: unknown }[] : [];
  const items: OrderItem[] = [];
  const tablePrices: Record<string, number> = {};
  const requestedQuantity = new Map<string, number>();
  let amount = 0;
  if (type === "table") {
    if ((!tableIds.length && !allowEmpty) || tableIds.length > 6 || new Set(tableIds).size !== tableIds.length) throw new AppError("เลือกได้ครั้งละ 1–6 โต๊ะ");
    for (const id of tableIds) {
      const match = /^([A-J])-(0[1-9]|[1-5][0-9]|60)$/.exec(id);
      if (!match) throw new AppError("หมายเลขโต๊ะไม่ถูกต้อง");
      if (data.blockedTables.includes(id) || data.orders.some((order) => order.id !== ignoreOrderId && activeOrder(order) && order.tableIds.includes(id))) throw new AppError(`โต๊ะ ${id} ถูกจองแล้ว กรุณาเลือกใหม่`);
      const price = existing?.tablePrices?.[id] ?? data.zones.find((zone) => zone.id === match[1])?.price ?? 0;
      tablePrices[id] = price;
      amount += price;
    }
  } else {
    if ((!requested.length && !allowEmpty) || requested.length > 20) throw new AppError("กรุณาเลือกสินค้า");
    for (const entry of requested) {
      const product = data.products.find((p) => p.id === str(entry.productId, 80) && (p.active || !!existing?.items.some((item) => item.productId === p.id)) && !p.archived);
      if (!product) throw new AppError("ไม่พบสินค้า");
      const quantity = int(entry.quantity, 0, 20);
      if (quantity === 0) continue;
      const optionId = str(entry.optionId, 80);
      const legacySize = str(entry.size, 30);
      const options = product.options ?? [];
      const option = options.find((choice) => choice.id === optionId) ?? options.find((choice) => choice.label === legacySize);
      if (options.length && !option) throw new AppError(`กรุณาเลือกคุณลักษณะของ ${product.name}`);
      const cumulative = (requestedQuantity.get(product.id) ?? 0) + quantity;
      if (product.stock - productUsed(data, product.id, ignoreOrderId) < cumulative) throw new AppError(`${product.name} เหลือไม่พอ`);
      requestedQuantity.set(product.id, cumulative);
      const original = existing?.items.find((item) => item.id === str(entry.id, 100) && item.productId === product.id && (item.optionId ?? "") === (option?.id ?? ""));
      items.push({ id: original?.id ?? randomUUID(), productId: product.id, name: product.name, quantity, unitPrice: original?.unitPrice ?? product.price, ...(option ? { optionId: option.id, size: option.label } : {}) });
      amount += (original?.unitPrice ?? product.price) * quantity;
    }
  }
  return { tableIds, items, tablePrices, amount };
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
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 100_000) throw new AppError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
    let body: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      body = value as Record<string, unknown>;
    } catch { throw new AppError("ข้อมูลคำขอไม่ถูกต้อง", 400); }
    const action = str(body.action, 40);
    const token = (await cookies()).get(COOKIE)?.value;

    if (action === "login") {
      const username = str(body.username, 80).toLowerCase();
      const limit = loginAllowed(username);
      if (!limit.allowed) return NextResponse.json({ error: "ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่" }, {
        status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" },
      });
      const password = str(body.password, 200);
      const sessionToken = randomBytes(32).toString("hex");
      const user = await mutateData((data) => {
        const found = data.users.find((entry) => entry.username === username && entry.active);
        if (!found || !verifyPassword(password, found.passwordHash)) throw new AppError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
        data.sessions.push({ token: sessionToken, userId: found.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), lastActiveAt: new Date().toISOString() });
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
      const phone = str(body.phone, 30);
      if (phone && !/^[0-9+() -]{8,30}$/.test(phone)) throw new AppError("เบอร์โทรศัพท์ไม่ถูกต้อง");
      if (!/^[a-z0-9_.]{4,40}$/.test(username)) throw new AppError("ชื่อผู้ใช้ต้องมี 4–40 ตัว ใช้อักษรอังกฤษ ตัวเลข จุด หรือ _");
      if (displayName.length < 2 || password.length < 8) throw new AppError("กรุณากรอกชื่อและรหัสผ่านอย่างน้อย 8 ตัว");
      const sessionToken = randomBytes(32).toString("hex");
      const user = await mutateData((data) => {
        if (data.users.some((entry) => entry.username === username)) throw new AppError("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
        if (phone && data.users.some((entry) => entry.phone === phone)) throw new AppError("เบอร์โทรนี้มีบัญชีแล้ว");
        const created: DemoUser = { id: randomUUID(), username, displayName, passwordHash: hashPassword(password), role: "customer", roles: ["customer"], phone: phone || undefined, contactSource: "web", active: true, createdAt: new Date().toISOString() };
        data.users.push(created);
        data.sessions.push({ token: sessionToken, userId: created.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), lastActiveAt: new Date().toISOString() });
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

      if (action === "saveOperationalSettings") {
        requireRole(me, ["superadmin"]);
        const current = settingsOf(data);
        const idleSeconds = int(body.idleSeconds, 30, 3600);
        data.settings = {
          ...current,
          tableHoldMinutes: int(body.tableHoldMinutes, 1, 43200),
          productHoldMinutes: int(body.productHoldMinutes, 1, 43200),
          assistedTableHoldMinutes: int(body.assistedTableHoldMinutes, 1, 43200),
          assistedProductHoldMinutes: int(body.assistedProductHoldMinutes, 1, 43200),
          revisionHoldMinutes: int(body.revisionHoldMinutes, 1, 43200),
          idleSeconds,
        };
        logAction(data, me.id, "save_operational_settings", JSON.stringify({
          table: data.settings.tableHoldMinutes, product: data.settings.productHoldMinutes,
          assistedTable: data.settings.assistedTableHoldMinutes, assistedProduct: data.settings.assistedProductHoldMinutes,
          revision: data.settings.revisionHoldMinutes, idleSeconds,
        }));
        return { settings: data.settings };
      }
      if (action === "publishBranding" || action === "restoreBranding") {
        requireRole(me, ["superadmin"]);
        const current = settingsOf(data);
        let branding = current.branding;
        if (action === "publishBranding") {
          const raw = body.branding;
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AppError("ข้อมูลหน้าเว็บไม่ถูกต้อง");
          const input = raw as Record<string, unknown>;
          const next = { ...defaultBranding };
          for (const key of Object.keys(defaultBranding) as (keyof typeof defaultBranding)[]) {
            const value = input[key];
            if (typeof value !== "string" || value.length > 500) throw new AppError(`ช่อง ${key} ไม่ถูกต้อง`);
            if (key.endsWith("Color")) {
              if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new AppError("รหัสสีต้องเป็น HEX 6 หลัก");
            } else if (["eventLogo", "ovcLogo", "heroDesktop", "heroMobile", "introImage", "tableBanner", "shopBanner", "closingImage"].includes(key)) {
              if (!validSiteImage(value) || (key !== "closingImage" && !value)) throw new AppError("ตำแหน่งภาพไม่ถูกต้อง");
            } else if (!value.trim()) throw new AppError("กรุณากรอกข้อความให้ครบ");
            next[key] = value.trim();
          }
          branding = next;
        } else {
          const index = int(body.revisionIndex, 0, 9);
          const revision = data.brandingHistory?.[index];
          if (!revision) throw new AppError("ไม่พบฉบับที่ต้องการย้อนกลับ");
          branding = revision.branding;
        }
        data.brandingHistory = [{ at: new Date().toISOString(), actorId: me.id, branding: current.branding }, ...(data.brandingHistory ?? [])].slice(0, 10);
        data.settings = { ...current, branding };
        logAction(data, me.id, action === "publishBranding" ? "publish_branding" : "restore_branding", "หน้า Home");
        return { branding };
      }
      if (action === "createOrder") {
        requireRole(me, ["customer", "superadmin"]);
        const type = body.type === "table" ? "table" : body.type === "product" ? "product" : null;
        if (!type) throw new AppError("ประเภทคำสั่งซื้อไม่ถูกต้อง");
        const { tableIds, items, tablePrices, amount } = selection(data, body, type);
        const now = new Date();
        const order: DemoOrder = {
          id: `SR90-${now.getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`,
          userId: me.id, type, status: "awaiting_slip", tableIds, items, tablePrices,
          meal: type === "table" ? str(body.meal, 100) || "ชุดอาหารมาตรฐาน" : "",
          dietaryNotes: type === "table" ? str(body.dietaryNotes, 500) : "",
          amount, createdAt: now.toISOString(), holdUntil: new Date(now.getTime() + (type === "table" ? settingsOf(data).tableHoldMinutes : settingsOf(data).productHoldMinutes) * 60_000).toISOString(),
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
        if (existing && !["assisted_draft", "awaiting_slip", "needs_revision", "approved"].includes(existing.status)) throw new AppError("รายการนี้แก้ไขไม่ได้");
        const customer = data.users.find((entry) => entry.id === (existing?.userId ?? str(body.userId, 80)) && entry.active && hasRole(entry, "customer"));
        if (!customer) throw new AppError("ไม่พบบัญชีลูกค้า", 404);
        const { tableIds, items, tablePrices, amount } = selection(data, body, type, existing?.id, !!existing);
        const now = new Date();
        const channel = str(body.channel, 20);
        if (!["phone", "line", "walkin"].includes(channel)) throw new AppError("กรุณาเลือกช่องทางที่ลูกค้าติดต่อ");
        const reason = str(body.reason, 200) || "ลูกค้าขอปรับรายการ";
        if (existing && !tableIds.length && !items.length) {
          try { cancelEntireOrder(existing, me, reason); }
          catch (error) { throw new AppError(error instanceof Error && error.message === "ALREADY_USED" ? "ใช้ตั๋วหรือรับสินค้าแล้ว ต้องให้ผู้ดูแลหลักพิจารณา" : "รายการนี้ยกเลิกไม่ได้"); }
          logAction(data, me.id, "cancel_assisted_order", `${existing.id}: ${reason}`);
          return { order: existing };
        }
        if (existing?.status === "approved") {
          if (orderIsUsed(existing)) throw new AppError("ใช้ตั๋วหรือรับสินค้าแล้ว ต้องให้ผู้ดูแลหลักพิจารณา");
          if (tableIds.some((id) => !existing.tableIds.includes(id)) || items.some((item) => !existing.items.some((old) => old.id === item.id && item.quantity <= old.quantity))) {
            throw new AppError("รายการที่ชำระแล้วลดหรือยกเลิกได้เท่านั้น หากต้องการเพิ่มให้สร้างรายการใหม่");
          }
          const refundAmount = recordRemovedSelections(existing, tableIds, items, me, reason);
          if (!refundAmount) throw new AppError("ยังไม่มีการลดรายการ");
          const removedTables = existing.tableIds.filter((id) => !tableIds.includes(id));
          const removedItemIds = existing.items.filter((old) => !items.some((item) => item.id === old.id && item.quantity === old.quantity)).map((item) => item.id ?? item.productId);
          const refund: OrderRefund = { id: randomUUID(), amount: refundAmount, reason, status: "pending", requestedAt: now.toISOString(), itemIds: removedItemIds, tableIds: removedTables };
          existing.refunds = [...(existing.refunds ?? []), refund];
          existing.paidAmount ??= existing.amount;
          existing.tableIds = tableIds;
          existing.items = items;
          existing.tablePrices = tablePrices;
          existing.amount = amount;
          logAction(data, me.id, "partial_cancel_paid", `${existing.id}: ${refundAmount}`);
          return { order: existing };
        }
        const summary = existing ? `เจ้าหน้าที่แก้ไขรายการ ยอดเดิม ฿${existing.amount} → ฿${amount}` : `เจ้าหน้าที่รับรายการทาง ${channel}`;
        const order: DemoOrder = existing ?? {
          id: `SR90-${now.getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`,
          userId: customer.id, type, status: "assisted_draft", tableIds: [], items: [], meal: "", dietaryNotes: "", amount: 0,
          createdAt: now.toISOString(), holdUntil: "", ticketCodes: [], checkedInCodes: [], history: [],
        };
        if (existing) recordRemovedSelections(order, tableIds, items, me, reason);
        order.tableIds = tableIds;
        order.items = items;
        order.tablePrices = tablePrices;
        order.amount = amount;
        order.meal = type === "table" ? str(body.meal, 100) || "ชุดอาหารมาตรฐาน" : "";
        order.dietaryNotes = type === "table" ? str(body.dietaryNotes, 500) : "";
        order.status = "assisted_draft";
        order.holdUntil = new Date(now.getTime() + (type === "table" ? settingsOf(data).assistedTableHoldMinutes : settingsOf(data).assistedProductHoldMinutes) * 60_000).toISOString();
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
        const reason = str(body.reason, 200);
        if (reason.length < 3) throw new AppError("กรุณาระบุเหตุผลการยกเลิก");
        try { cancelEntireOrder(order, me, reason); }
        catch (error) { throw new AppError(error instanceof Error && error.message === "ALREADY_USED" ? "ใช้ตั๋วหรือรับสินค้าแล้ว ต้องให้ผู้ดูแลหลักพิจารณา" : "รายการนี้ยกเลิกไปแล้ว"); }
        logAction(data, me.id, "cancel_assisted_order", `${order.id}: ${reason}`);
        return { order };
      }

      if (action === "cancelOrder") {
        const order = data.orders.find((entry) => entry.id === str(body.orderId, 60));
        if (!order) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        if (order.userId !== me.id && !hasRole(me, "superadmin")) throw new AppError("ไม่มีสิทธิ์ยกเลิก", 403);
        if (order.status === "approved" && !hasRole(me, "superadmin")) throw new AppError("รายการที่ชำระแล้วกรุณาติดต่อเจ้าหน้าที่");
        try { cancelEntireOrder(order, me, str(body.reason, 200) || "ลูกค้าขอยกเลิก"); }
        catch (error) { throw new AppError(error instanceof Error && error.message === "ALREADY_USED" ? "ใช้ตั๋วหรือรับสินค้าแล้ว ต้องให้ผู้ดูแลหลักพิจารณา" : "รายการนี้ยกเลิกไปแล้ว"); }
        logAction(data, me.id, "cancel_order", order.id);
        return { order };
      }

      if (action === "resolveCancellation") {
        requireRole(me, ["superadmin", "finance"]);
        const order = data.orders.find((entry) => entry.id === str(body.orderId, 60));
        if (!order) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        const reference = str(body.reference, 150);
        if (reference.length < 3) throw new AppError("กรุณาระบุผลตรวจหรือเลขอ้างอิง");
        try { resolveCancellation(order, me, body.paymentFound === true, reference); }
        catch { throw new AppError("รายการนี้ไม่ได้รอการเงินตรวจการยกเลิก"); }
        logAction(data, me.id, "resolve_cancellation", `${order.id}: ${body.paymentFound === true ? "พบยอด" : "ไม่พบยอด"}`);
        return { order };
      }

      if (action === "completeRefund") {
        requireRole(me, ["superadmin", "finance"]);
        const order = data.orders.find((entry) => entry.id === str(body.orderId, 60));
        if (!order) throw new AppError("ไม่พบคำสั่งซื้อ", 404);
        const reference = str(body.reference, 150);
        if (reference.length < 3) throw new AppError("กรุณาใส่เลขอ้างอิงการคืนเงินจริง");
        try { completeRefund(order, str(body.refundId, 80), me, reference); }
        catch { throw new AppError("ไม่พบงานคืนเงินที่รอดำเนินการ"); }
        logAction(data, me.id, "complete_refund", `${order.id}: ${reference}`);
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
        if (decision === "revise") order.holdUntil = new Date(Date.now() + settingsOf(data).revisionHoldMinutes * 60_000).toISOString();
        order.reviewedBy = me.id;
        order.reviewedAt = new Date().toISOString();
        if (decision === "approve") {
          order.paidAmount = order.amount;
          if (order.type === "table") order.ticketCodes = order.tableIds.flatMap((id) => Array.from({ length: 8 }, (_, index) => `${id}-${index + 1}-${randomBytes(2).toString("hex").toUpperCase()}`));
          else order.pickupCode = `PICK-${randomBytes(4).toString("hex").toUpperCase()}`;
        }
        logAction(data, me.id, decision === "approve" ? "approve_order" : "request_revision", order.id);
        return { order };
      }

      if (action === "addCategory") {
        requireRole(me, ["superadmin", "merch"]);
        const name = str(body.name, 60);
        if (name.length < 2) throw new AppError("กรุณาใส่ชื่อประเภทอย่างน้อย 2 ตัว");
        data.categories ??= [];
        if (data.categories.some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new AppError("มีประเภทนี้แล้ว");
        data.categories.push(name);
        logAction(data, me.id, "add_category", name);
        return { category: name };
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
        const category = str(body.category, 60);
        if (name.length < 2) throw new AppError("กรุณาใส่ชื่อสินค้า");
        if (!data.categories?.includes(category)) throw new AppError("กรุณาเลือกประเภทสินค้าที่มีอยู่");
        if (image && !/^\/(assets|uploads|api\/product-image)\/[a-zA-Z0-9._/-]+$/.test(image)) throw new AppError("ตำแหน่งรูปภาพไม่ถูกต้อง");
        const used = existing ? productUsed(data, existing.id) : 0;
        if (stock < used) throw new AppError(`สต็อกต่ำกว่าจำนวนที่จอง/ขายแล้ว (${used})`);
        const requested = Array.isArray(body.options) ? body.options as { id?: unknown; label?: unknown }[] : [];
        if (requested.length > 30) throw new AppError("คุณลักษณะมากเกินไป");
        const options = requested.map((entry) => ({ id: str(entry.id, 80) || randomUUID(), label: str(entry.label, 30) }));
        if (options.some((option) => !option.label) || new Set(options.map((option) => option.id)).size !== options.length || new Set(options.map((option) => option.label.toLocaleLowerCase())).size !== options.length) throw new AppError("คุณลักษณะซ้ำหรือว่าง");
        if (existing) {
          const removedIds = (existing.options ?? []).filter((option) => !options.some((current) => current.id === option.id)).map((option) => option.id);
          const usedOption = data.orders.some((order) => activeOrder(order) && order.items.some((item) => item.productId === existing.id && removedIds.includes(item.optionId ?? "")));
          if (usedOption) throw new AppError("ลบคุณลักษณะที่มีลูกค้าสั่งอยู่ไม่ได้ กรุณาย้ายหรือยกเลิกรายการก่อน");
        }
        const product = {
          id: existing?.id ?? randomUUID(), name, description, price, stock,
          image: image || "/assets/souvenir-unbranded.png", category,
          sizes: options.map((option) => option.label), options,
          active: body.active !== false, archived: false,
        };
        if (existing) Object.assign(existing, product); else data.products.push(product);
        logAction(data, me.id, "save_product", product.name);
        return { product };
      }

      if (action === "deleteProduct") {
        requireRole(me, ["superadmin", "merch"]);
        const id = str(body.id, 80);
        const product = data.products.find((entry) => entry.id === id);
        if (!product) throw new AppError("ไม่พบสินค้า", 404);
        if (data.orders.some((order) => activeOrder(order) && order.items.some((item) => item.productId === id))) throw new AppError("ยังมีลูกค้าถือรายการสินค้านี้อยู่ กรุณายกเลิกหรือปิดขายก่อน");
        // Keep a hidden product record when cancelled orders still refer to its stable option IDs.
        const hasHistory = data.orders.some((order) => [...order.items, ...(order.cancelledItems ?? [])].some((item) => item.productId === id));
        if (hasHistory) { product.archived = true; product.active = false; }
        else data.products = data.products.filter((entry) => entry.id !== id);
        logAction(data, me.id, "delete_product", `${product.id}: ${product.name}`);
        return { id };
      }
      if (action === "saveZone") {
        requireRole(me, ["superadmin", "tables"]);
        const zone = data.zones.find((entry) => entry.id === str(body.id, 1));
        if (!zone) throw new AppError("ไม่พบโซน");
        zone.price = int(body.price, 0, 1_000_000);
        logAction(data, me.id, "save_zone_price", `${zone.id}: ${zone.price}`);
        return { zone };
      }

      if (action === "updateUser") {
        requireRole(me, ["superadmin"]);
        const target = data.users.find((entry) => entry.id === str(body.userId, 80));
        if (!target) throw new AppError("ไม่พบบัญชี", 404);
        const displayName = str(body.displayName, 80);
        const username = str(body.username, 40).toLowerCase();
        const phone = str(body.phone, 30);
        const password = str(body.password, 200);
        if (displayName.length < 2 || !/^[a-z0-9_.]{4,40}$/.test(username)) throw new AppError("ชื่อหรือชื่อผู้ใช้ไม่ถูกต้อง");
        if (phone && !/^[0-9+() -]{8,30}$/.test(phone)) throw new AppError("เบอร์โทรศัพท์ไม่ถูกต้อง");
        if (data.users.some((entry) => entry.id !== target.id && entry.username === username)) throw new AppError("ชื่อผู้ใช้นี้มีแล้ว");
        if (phone && data.users.some((entry) => entry.id !== target.id && entry.phone === phone)) throw new AppError("เบอร์โทรนี้มีบัญชีแล้ว");
        if (password && password.length < 8) throw new AppError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว");
        if (target.id === me.id && body.active === false) throw new AppError("ปิดบัญชีที่กำลังใช้งานไม่ได้");
        target.displayName = displayName;
        target.username = username;
        target.phone = phone || undefined;
        target.active = body.active !== false;
        if (password) { target.passwordHash = hashPassword(password); data.sessions = data.sessions.filter((session) => session.userId !== target.id); }
        if (!target.active) data.sessions = data.sessions.filter((session) => session.userId !== target.id);
        logAction(data, me.id, "update_user", target.id);
        return { user: publicUser(target) };
      }

      if (action === "deleteUser") {
        requireRole(me, ["superadmin"]);
        const target = data.users.find((entry) => entry.id === str(body.userId, 80));
        if (!target) throw new AppError("ไม่พบบัญชี", 404);
        if (target.id === me.id) throw new AppError("ลบบัญชีที่กำลังใช้งานไม่ได้");
        const hasOrders = data.orders.some((order) => order.userId === target.id || order.assistedBy === target.id || order.reviewedBy === target.id);
        const hasBusinessAudit = data.audit.some((entry) => entry.actorId === target.id && !["register", "create_customer"].includes(entry.action));
        data.sessions = data.sessions.filter((session) => session.userId !== target.id);
        if (hasOrders || hasBusinessAudit) {
          target.username = `deleted_${target.id.replaceAll("-", "").slice(0, 20)}`;
          target.displayName = "บัญชีที่ปิดแล้ว";
          target.phone = undefined;
          target.passwordHash = hashPassword(randomBytes(24).toString("hex"));
          target.active = false;
          logAction(data, me.id, "deactivate_user", target.id);
          return { archived: true };
        }
        data.users = data.users.filter((entry) => entry.id !== target.id);
        logAction(data, me.id, "delete_user", target.id);
        return { deleted: true };
      }
      if (action === "setRoles" || action === "setRole") {
        requireRole(me, ["superadmin"]);
        const target = data.users.find((entry) => entry.id === str(body.userId, 80));
        const assigned = (Array.isArray(body.roles) ? body.roles : [body.role]).map((value) => str(value, 20) as Role);
        if (!target || !assigned.length || assigned.length > 5 || new Set(assigned).size !== assigned.length || assigned.some((role) => !roles.includes(role))) throw new AppError("ข้อมูลผู้ใช้หรือบทบาทไม่ถูกต้อง");
        if ((assigned.includes("customer") || assigned.includes("superadmin")) && assigned.length !== 1) throw new AppError("ลูกค้าและผู้ดูแลระบบหลักต้องเป็นบทบาทเดี่ยว");
        if (!target.active) throw new AppError("บัญชีนี้ถูกปิดแล้ว");
        if (hasRole(target, "customer") !== assigned.includes("customer") && data.orders.some((order) => order.userId === target.id)) throw new AppError("บัญชีลูกค้าที่มีคำสั่งซื้อไม่ควรเปลี่ยนเป็นเจ้าหน้าที่ กรุณาสร้างบัญชีเจ้าหน้าที่แยก");
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
    const latest = await readData();
    const viewer = currentUser(latest, token);
    const safe = "order" in result && result.order
      ? { ...result, order: viewer ? visibleOrder(latest, result.order, viewer) : null }
      : result;
    return NextResponse.json({ ok: true, ...safe }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return responseError(error); }
}
