import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DemoData, DemoOrder, DemoSnapshot, DemoUser, PublicUser, Role } from "./demo-types";
import { mutatePostgresData, readPostgresData, touchPostgresSession } from "./postgres-store";
import { defaultSettings, settingsOf } from "./site-settings";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "demo.json");
let pending: Promise<unknown> = Promise.resolve();

export const publicUser = (user: DemoUser): PublicUser => {
  const { passwordHash: _passwordHash, ...safe } = user;
  void _passwordHash;
  return safe;
};

export function hasRole(user: Pick<DemoUser, "role" | "roles">, role: Role): boolean {
  return (user.roles?.length ? user.roles : [user.role]).includes(role);
}

export function canAssist(user: Pick<DemoUser, "role" | "roles">): boolean {
  return hasRole(user, "superadmin") || hasRole(user, "tables") || hasRole(user, "merch");
}

export function hashPassword(password: string): string {
  const salt = randomUUID().replaceAll("-", "");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function seedData(): DemoData {
  const now = new Date().toISOString();
  const passwordHash = hashPassword("Demo@1234");
  const user = (username: string, displayName: string, role: Role, roles: Role[] = [role]): DemoUser => ({
    id: randomUUID(), username, displayName, role, roles, passwordHash, active: true, createdAt: now,
  });
  const seeded: DemoData = {
    schemaVersion: 2,
    settings: structuredClone(defaultSettings),
    users: [
      user("superadmin", "ผู้ดูแลระบบ", "superadmin"),
      user("tableadmin", "ฝ่ายโต๊ะจีน", "tables", ["tables", "merch"]),
      user("shopadmin", "ฝ่ายของที่ระลึก", "merch"),
      user("finance", "ฝ่ายการเงิน", "finance"),
      user("gate", "ฝ่ายหน้างาน", "gate"),
      user("customer", "ศิษย์เก่าสาธิต", "customer"),
    ],
    sessions: [],
    zones: [
      { id: "A", price: 4500, color: "#d8a43d", softColor: "#fbf2d8", label: "ใกล้เวที" },
      { id: "B", price: 4500, color: "#3f9871", softColor: "#e4f4ea", label: "ใกล้เวที" },
      { id: "C", price: 3900, color: "#d96d73", softColor: "#fbe9e9", label: "โซนกลาง" },
      { id: "D", price: 3900, color: "#de8955", softColor: "#fff0e5", label: "โซนกลาง" },
      { id: "E", price: 3500, color: "#548cdb", softColor: "#e8f2ff", label: "โซนกลาง" },
      { id: "F", price: 3500, color: "#c05cba", softColor: "#f9eafb", label: "โซนกลาง" },
      { id: "G", price: 3200, color: "#42aeb5", softColor: "#e1f9fb", label: "โซนหลัง" },
      { id: "H", price: 3200, color: "#667792", softColor: "#edf2f9", label: "โซนหลัง" },
      { id: "I", price: 2900, color: "#6ab66f", softColor: "#eaf9e8", label: "โซนหลัง" },
      { id: "J", price: 2900, color: "#835acf", softColor: "#f2eafd", label: "โซนหลัง" },
    ],
    products: [
      { id: "polo", name: "เสื้อโปโล 90 ปี รุ่นพิเศษ", description: "เสื้อโปโลสีกรมท่า ลวดลายสีฟ้า ผลิตเพื่อการพบกันครั้งพิเศษ", price: 590, stock: 120, image: "/assets/shirt-reference.png", category: "เครื่องแต่งกาย", sizes: ["S", "M", "L", "XL", "2XL"], active: true },
      { id: "gift", name: "ชุดของที่ระลึก 90 ปี", description: "แก้ว กระเป๋าผ้า และเข็มกลัด สำหรับเก็บความทรงจำ", price: 790, stock: 75, image: "/assets/souvenir-unbranded.png", category: "ของที่ระลึก", sizes: [], active: true },
      { id: "pin", name: "เข็มกลัดที่ระลึก", description: "ของชิ้นเล็กที่พกความทรงจำไว้ได้ทุกวัน", price: 190, stock: 200, image: "/assets/souvenir-unbranded.png", category: "ของที่ระลึก", sizes: [], active: true },
    ],
    blockedTables: ["A-05", "A-19", "A-31", "B-08", "B-29", "C-12", "D-17", "E-24", "F-41", "G-18", "H-09", "I-53", "J-34"],
    orders: [],
    audit: [],
  };
  addSampleOrders(seeded);
  return seeded;
}

function addSampleOrders(data: DemoData): void {
  const customer = data.users.find((user) => user.username === "customer");
  if (!customer) return;
  const now = new Date();
  const made = now.toISOString();
  const draftExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const examples: DemoOrder[] = [
    {
      id: "DEMO-TABLE-PAID", userId: customer.id, type: "table", status: "approved", tableIds: ["A-14"], items: [],
      meal: "ชุดอาหารมาตรฐาน", dietaryNotes: "", amount: 4500, createdAt: made, holdUntil: made,
      ticketCodes: Array.from({ length: 8 }, (_, index) => `A-14-${index + 1}-DEMO`), checkedInCodes: [],
      channel: "web", history: [{ at: made, actor: "ระบบสาธิต", summary: "ตัวอย่างรายการที่ชำระเงินแล้ว" }],
    },
    {
      id: "DEMO-PRODUCT-PAID", userId: customer.id, type: "product", status: "approved", tableIds: [],
      items: [{ productId: "gift", name: "ชุดของที่ระลึก 90 ปี", quantity: 1, unitPrice: 790 }],
      meal: "", dietaryNotes: "", amount: 790, createdAt: made, holdUntil: made,
      ticketCodes: [], checkedInCodes: [], pickupCode: "PICK-DEMO90", channel: "web",
      history: [{ at: made, actor: "ระบบสาธิต", summary: "ตัวอย่างสินค้าที่ชำระเงินแล้ว" }],
    },
    {
      id: "DEMO-TABLE-ASSIST", userId: customer.id, type: "table", status: "assisted_draft", tableIds: ["B-12"], items: [],
      meal: "ชุดอาหารไม่ใส่เนื้อวัว", dietaryNotes: "ไม่ใส่เนื้อวัว", amount: 4500, createdAt: made, holdUntil: draftExpiry,
      ticketCodes: [], checkedInCodes: [], channel: "phone", history: [{ at: made, actor: "ฝ่ายโต๊ะจีน", summary: "บันทึกการจองทางโทรศัพท์เพื่อทดลองเพิ่มหรือลดโต๊ะ" }],
    },
    {
      id: "DEMO-PRODUCT-ASSIST", userId: customer.id, type: "product", status: "assisted_draft", tableIds: [],
      items: [{ productId: "polo", name: "เสื้อโปโล 90 ปี รุ่นพิเศษ", quantity: 2, unitPrice: 590, size: "L" }],
      meal: "", dietaryNotes: "", amount: 1180, createdAt: made, holdUntil: draftExpiry,
      ticketCodes: [], checkedInCodes: [], channel: "line", history: [{ at: made, actor: "ฝ่ายของที่ระลึก", summary: "บันทึกการสั่งเสื้อทาง LINE เพื่อทดลองปรับจำนวน" }],
    },
  ];
  for (const example of examples) {
    if (!data.orders.some((order) => order.id === example.id)) data.orders.push(example);
  }
}

export function migrateData(data: DemoData): DemoData {
  for (const product of data.products) {
    if (product.image === "/assets/polo.png") product.image = "/assets/shirt-reference.png";
    if (product.image === "/assets/gift-set.png") product.image = "/assets/souvenir-unbranded.png";
  }
  for (const user of data.users) {
    if (!Array.isArray(user.roles) || !user.roles.length) user.roles = user.username === "tableadmin" ? ["tables", "merch"] : [user.role];
    user.role = user.roles[0];
  }
  if ((data.schemaVersion ?? 0) < 2) {
    addSampleOrders(data);
    data.schemaVersion = 2;
  }
  if ((data.schemaVersion ?? 0) < 3) {
    const defaults = ["\u0e40\u0e2a\u0e37\u0e49\u0e2d", "\u0e41\u0e01\u0e49\u0e27\u0e19\u0e49\u0e33", "\u0e1c\u0e49\u0e32\u0e1e\u0e31\u0e19\u0e04\u0e2d"];
    for (const product of data.products) {
      if (product.id === "polo") product.category = "\u0e40\u0e2a\u0e37\u0e49\u0e2d";
      product.options ??= product.sizes.map((label, index) => ({ id: `${product.id}-option-${index + 1}`, label }));
    }
    for (const order of data.orders) {
      order.cancelledItems ??= [];
      order.cancelledTables ??= [];
      order.cancelledTicketCodes ??= [];
      order.refunds ??= [];
      order.items.forEach((item, index) => {
        item.id ??= `${order.id}-item-${index + 1}`;
        const product = data.products.find((entry) => entry.id === item.productId);
        item.optionId ??= product?.options?.find((option) => option.label === item.size)?.id;
      });
    }
    data.categories = [...new Set([...defaults, ...data.products.map((product) => product.category)])];
    data.schemaVersion = 3;
  }
  if ((data.schemaVersion ?? 0) < 4) {
    for (const order of data.orders) {
      if (order.slipFile && !order.slips?.length) order.slips = [{ id: order.slipFile, filename: order.slipFile, name: order.slipName ?? "slip", uploadedAt: order.createdAt }];
      if (order.status === "needs_revision") order.holdUntil = new Date(Date.parse(order.reviewedAt ?? order.createdAt) + defaultSettings.revisionHoldMinutes * 60_000).toISOString();
    }
    for (const session of data.sessions) session.lastActiveAt ??= new Date(Date.parse(session.expiresAt) - 12 * 60 * 60_000).toISOString();
    data.settings = settingsOf(data);
    data.brandingHistory ??= [];
    data.schemaVersion = 4;
  }
  data.settings = settingsOf(data);
  data.brandingHistory ??= [];
  data.categories ??= ["\u0e40\u0e2a\u0e37\u0e49\u0e2d", "\u0e41\u0e01\u0e49\u0e27\u0e19\u0e49\u0e33", "\u0e1c\u0e49\u0e32\u0e1e\u0e31\u0e19\u0e04\u0e2d"];
  for (const order of data.orders) {
    if (order.type === "table" && !order.tablePrices) {
      order.tablePrices = Object.fromEntries(order.tableIds.map((id) => [id, data.zones.find((zone) => zone.id === id[0])?.price ?? Math.round(order.amount / Math.max(1, order.tableIds.length))]));
    }
    if (["approved", "refund_pending", "refunded"].includes(order.status)) order.paidAmount ??= order.amount;
  }
  return data;
}

async function ensureData(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try { await fs.access(dataFile); }
  catch { await fs.writeFile(dataFile, JSON.stringify(seedData(), null, 2), { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; }); }
}

export async function readData(): Promise<DemoData> {
  if (process.env.DATABASE_URL) return migrateData(await readPostgresData());
  await ensureData();
  return migrateData(JSON.parse(await fs.readFile(dataFile, "utf8")) as DemoData);
}

export async function mutateData<T>(fn: (data: DemoData) => Promise<T> | T): Promise<T> {
  if (process.env.DATABASE_URL) return mutatePostgresData(fn);
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const previous = pending;
  pending = current;
  await previous;
  try {
    const data = await readData();
    const result = await fn(data);
    const tempFile = `${dataFile}.${randomUUID()}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
    await fs.rename(tempFile, dataFile);
    return result;
  } finally { release(); }
}

export function currentUser(data: DemoData, token: string | undefined): DemoUser | null {
  if (!token) return null;
  const session = data.sessions.find((entry) => entry.token === token && Date.parse(entry.expiresAt) > Date.now());
  if (!session) return null;
  const lastActive = Date.parse(session.lastActiveAt ?? "") || Date.parse(session.expiresAt) - 12 * 60 * 60_000;
  if (Date.now() - lastActive > settingsOf(data).idleSeconds * 1000) return null;
  return data.users.find((user) => user.id === session.userId && user.active) ?? null;
}

export function activeOrder(order: DemoOrder): boolean {
  if (order.status === "approved" || order.status === "under_review" || order.status === "cancellation_review" || order.status === "refund_pending") return true;
  if (order.status === "assisted_draft" || order.status === "needs_revision") return Date.parse(order.holdUntil) > Date.now();
  return order.status === "awaiting_slip" && Date.parse(order.holdUntil) > Date.now();
}

export function snapshot(data: DemoData, me: DemoUser | null): DemoSnapshot {
  const tableStatuses: DemoSnapshot["tableStatuses"] = {};
  const productAvailable: DemoSnapshot["productAvailable"] = {};
  for (const product of data.products) productAvailable[product.id] = product.stock;
  for (const id of data.blockedTables) tableStatuses[id] = "sold";
  for (const order of data.orders) {
    if (!activeOrder(order)) continue;
    for (const tableId of order.tableIds) tableStatuses[tableId] = order.status === "approved" ? "sold" : "reserved";
    for (const item of order.items) productAvailable[item.productId] = Math.max(0, (productAvailable[item.productId] ?? 0) - item.quantity);
  }
  const visibleOrders = !me ? [] : data.orders
    .filter((order) => !hasRole(me, "customer") || order.userId === me.id)
    .map((order) => {
      const currentLabel = (item: { productId: string; optionId?: string; size?: string }) => data.products.find((product) => product.id === item.productId)?.options?.find((option) => option.id === item.optionId)?.label ?? item.size;
      const displayOrder = {
        ...order,
        items: order.items.map((item) => ({ ...item, size: currentLabel(item) })),
        cancelledItems: order.cancelledItems?.map((item) => ({ ...item, size: currentLabel(item) })),
      };
      if (hasRole(me, "superadmin") || hasRole(me, "customer")) return displayOrder;
      return {
        ...displayOrder,
        slipFile: hasRole(me, "finance") ? order.slipFile : undefined,
        slips: hasRole(me, "finance") ? order.slips : undefined,
        slipName: hasRole(me, "finance") ? order.slipName : undefined,
        dietaryNotes: hasRole(me, "tables") ? order.dietaryNotes : "",
        ticketCodes: [],
        checkedInCodes: [],
        pickupCode: undefined,
      };
    });
  return {
    me: me ? publicUser(me) : null,
    products: data.products,
    zones: data.zones,
    tableStatuses,
    productAvailable,
    orders: visibleOrders,
    users: me && hasRole(me, "superadmin") ? data.users.map(publicUser) : [],
    customers: me && canAssist(me) ? data.users.filter((user) => hasRole(user, "customer")).map(publicUser) : [],
    orderCustomers: me && !hasRole(me, "customer")
      ? data.users.filter((user) => hasRole(user, "customer")).map(({ id, displayName, username, phone }) => ({ id, displayName, username, ...(phone ? { phone } : {}) }))
      : [],
    categories: data.categories ?? ["\u0e40\u0e2a\u0e37\u0e49\u0e2d", "\u0e41\u0e01\u0e49\u0e27\u0e19\u0e49\u0e33", "\u0e1c\u0e49\u0e32\u0e1e\u0e31\u0e19\u0e04\u0e2d"],
    settings: settingsOf(data),
    brandingHistory: me && hasRole(me, "superadmin") ? data.brandingHistory ?? [] : [],
    audit: me && hasRole(me, "superadmin") ? data.audit.slice(-30).reverse() : [],
  };
}

export function logAction(data: DemoData, actorId: string, action: string, detail: string): void {
  data.audit.push({ at: new Date().toISOString(), actorId, action, detail });
  if (data.audit.length > 500) data.audit.splice(0, data.audit.length - 500);
}

export async function touchSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  if (process.env.DATABASE_URL) return touchPostgresSession(token);
  return mutateData((data) => {
    const user = currentUser(data, token);
    if (!user) return false;
    const session = data.sessions.find((entry) => entry.token === token);
    if (!session) return false;
    session.lastActiveAt = new Date().toISOString();
    return true;
  });
}