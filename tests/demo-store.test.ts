import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeOrder, currentUser, hashPassword, snapshot, verifyPassword } from "../lib/demo-store";
import ExcelJS from "exceljs";
import { exportCustomerXlsx } from "../lib/export-xlsx";
import { defaultSettings } from "../lib/site-settings";
import type { DemoData, DemoOrder, DemoUser } from "../lib/demo-types";

const now = new Date().toISOString();
const makeUser = (role: DemoUser["role"]): DemoUser => ({ id: role, username: role, displayName: role, role, roles: [role], passwordHash: "hidden", active: true, createdAt: now });
const baseOrder = (overrides: Partial<DemoOrder> = {}): DemoOrder => ({
  id: "ORDER-1", userId: "customer", type: "table", status: "awaiting_slip", tableIds: ["A-01"], items: [],
  meal: "ชุดอาหารมาตรฐาน", dietaryNotes: "แพ้กุ้ง", amount: 4500, createdAt: now,
  holdUntil: new Date(Date.now() + 600_000).toISOString(), ticketCodes: [], checkedInCodes: [], ...overrides,
});
const baseData = (orders: DemoOrder[]): DemoData => ({
  users: [makeUser("customer"), makeUser("finance"), makeUser("gate")], sessions: [],
  products: [{ id: "shirt", name: "เสื้อ", description: "", price: 590, stock: 10, image: "", category: "", sizes: [], active: true }],
  zones: [{ id: "A", price: 4500, color: "", softColor: "", label: "" }], orders,
  blockedTables: ["B-01"], audit: [],
});

describe("การกันโต๊ะและสินค้า", () => {
  it("คืนโต๊ะเมื่อรายการรอสลิปหมดเวลา แต่เก็บรายการรอตรวจไว้", () => {
    assert.equal(activeOrder(baseOrder({ holdUntil: new Date(Date.now() - 1_000).toISOString() })), false);
    assert.equal(activeOrder(baseOrder({ status: "under_review", holdUntil: new Date(Date.now() - 1_000).toISOString() })), true);
    assert.equal(activeOrder(baseOrder({ status: "assisted_draft" })), true);
    assert.equal(activeOrder(baseOrder({ status: "assisted_draft", holdUntil: new Date(Date.now() - 1_000).toISOString() })), false);
  });

  it("คำนวณสต็อกที่เหลือจากคำสั่งซื้อซึ่งยังกันของอยู่", () => {
    const reserved = baseOrder({ id: "P-1", type: "product", tableIds: [], items: [{ productId: "shirt", name: "เสื้อ", quantity: 2, unitPrice: 590 }], status: "under_review" });
    const approved = baseOrder({ id: "P-2", type: "product", tableIds: [], items: [{ productId: "shirt", name: "เสื้อ", quantity: 3, unitPrice: 590 }], status: "approved" });
    const cancelled = baseOrder({ id: "P-3", type: "product", tableIds: [], items: [{ productId: "shirt", name: "เสื้อ", quantity: 4, unitPrice: 590 }], status: "cancelled" });
    assert.equal(snapshot(baseData([reserved, approved, cancelled]), makeUser("customer")).productAvailable.shirt, 5);
  });
});

describe("บัญชีและสิทธิ์", () => {
  it("ตรวจรหัสผ่านที่ถูกต้องและปฏิเสธรหัสผิด", () => {
    const stored = hashPassword("Demo@1234");
    assert.equal(verifyPassword("Demo@1234", stored), true);
    assert.equal(verifyPassword("wrong", stored), false);
  });

  it("ทุกฝ่ายเห็นสถานะคำสั่งซื้อร่วมกัน แต่ข้อมูลอ่อนไหวแยกตามสิทธิ์", () => {
    const review = baseOrder({ status: "under_review", slipFile: "private.jpg" });
    const approved = baseOrder({ id: "ORDER-2", status: "approved", ticketCodes: ["A-01-1-TEST"], pickupCode: "PICK-TEST" });
    const data = baseData([review, approved]);
    const finance = snapshot(data, makeUser("finance"));
    const gate = snapshot(data, makeUser("gate"));
    const merch = snapshot(data, makeUser("merch"));
    assert.equal(finance.orders[0].dietaryNotes, "");
    assert.equal(finance.orders[0].slipFile, "private.jpg");
    assert.equal(gate.orders.length, 2);
    assert.equal(gate.orders[0].slipFile, undefined);
    assert.equal(gate.orders[0].dietaryNotes, "");
    assert.deepEqual(gate.orders[1].ticketCodes, []);
    assert.equal(gate.orders[1].pickupCode, undefined);
    assert.deepEqual(merch.orders.map((order) => order.id), ["ORDER-1", "ORDER-2"]);
    assert.equal(merch.orders[0].slipFile, undefined);
    assert.deepEqual(gate.orderCustomers, [{ id: "customer", displayName: "customer", username: "customer" }]);
  });

  it("เจ้าหน้าที่สองบทบาทเห็นทั้งรายการโต๊ะและสินค้า และรายชื่อลูกค้า", () => {
    const table = baseOrder({ id: "T-1", type: "table" });
    const product = baseOrder({ id: "P-1", type: "product", tableIds: [], items: [{ productId: "shirt", name: "เสื้อ", quantity: 1, unitPrice: 590 }] });
    const staff = { ...makeUser("tables"), roles: ["tables", "merch"] as DemoUser["roles"] };
    const view = snapshot(baseData([table, product]), staff);
    assert.deepEqual(view.orders.map((order) => order.id), ["T-1", "P-1"]);
    assert.equal(view.customers.length, 1);
  });
});

it("เวลาและ session: ตีกลับสลิปหมดอายุแล้วคืนสิทธิ์ และ idle ตัดการเข้าถึง", () => {
  const order = baseOrder({ status: "needs_revision", holdUntil: new Date(Date.now() - 1000).toISOString() });
  assert.equal(activeOrder(order), false);
  const data = baseData([order]);
  data.settings = { ...defaultSettings, idleSeconds: 300 };
  data.sessions = [{ token: "idle", userId: "customer", expiresAt: new Date(Date.now() + 3600_000).toISOString(), lastActiveAt: new Date(Date.now() - 301_000).toISOString() }];
  assert.equal(currentUser(data, "idle"), null);
  data.sessions[0].lastActiveAt = new Date().toISOString();
  assert.equal(currentUser(data, "idle")?.id, "customer");
});

it("Excel เปิดกลับได้ มีตัวกรอง คอลัมน์กว้าง และตัดบรรทัดรายละเอียด", async () => {
  const data = baseData([baseOrder({ dietaryNotes: "แพ้อาหารทะเล ต้องแยกอาหารอย่างชัดเจน" })]);
  const bytes = await exportCustomerXlsx(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  const sheet = workbook.getWorksheet("สถานะลูกค้า");
  assert.ok(sheet);
  assert.ok(sheet.getRow(2).getCell(1).value);
  assert.equal(sheet.getColumn(1).width, 39);
  assert.equal(sheet.getRow(2).getCell(1).alignment?.wrapText, true);
  assert.deepEqual(sheet.views[0].state, "frozen");
  assert.ok(sheet.autoFilter);
});