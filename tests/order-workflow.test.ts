import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cancelEntireOrder, completeRefund, recordRemovedSelections, resolveCancellation } from "../lib/order-workflow";
import { exportCustomerCsv } from "../lib/export-csv";
import type { DemoData, DemoOrder, DemoUser } from "../lib/demo-types";

const now = new Date().toISOString();
const actor: DemoUser = { id: "staff", username: "staff", displayName: "เจ้าหน้าที่", role: "tables", roles: ["tables"], passwordHash: "unused", active: true, createdAt: now };
const customer: DemoUser = { ...actor, id: "customer", username: "customer", displayName: "=SUM(A1:A2)", role: "customer", roles: ["customer"] };
const order = (status: DemoOrder["status"]): DemoOrder => ({
  id: "O-1", userId: customer.id, type: "table", status, tableIds: ["A-01", "A-02"], tablePrices: { "A-01": 4500, "A-02": 4500 },
  items: [], meal: "standard", dietaryNotes: "", amount: 9000, paidAmount: status === "approved" ? 9000 : undefined,
  createdAt: now, holdUntil: now, ticketCodes: ["A-01-1-TEST", "A-02-1-TEST"], checkedInCodes: [],
});

describe("การยกเลิกและคืนเงิน", () => {
  it("รายการรอสลิปยกเลิกแล้วคงรายละเอียดเดิม", () => {
    const target = order("awaiting_slip");
    cancelEntireOrder(target, actor, "ลูกค้าขอยกเลิก");
    assert.equal(target.status, "cancelled");
    assert.deepEqual(target.tableIds, ["A-01", "A-02"]);
    assert.equal(target.refunds?.length ?? 0, 0);
  });
  it("หลังส่งสลิปต้องตรวจยอดก่อนตัดสินใจคืนเงิน", () => {
    const target = order("under_review");
    cancelEntireOrder(target, actor, "ลูกค้าขอยกเลิก");
    assert.equal(target.status, "cancellation_review");
    resolveCancellation(target, actor, true, "BANK-123");
    assert.equal(target.status, "refund_pending");
    assert.equal(target.refunds?.[0].amount, 9000);
    completeRefund(target, target.refunds![0].id, actor, "REF-123");
    assert.equal(target.status, "refunded");
  });
  it("ลดโต๊ะที่จ่ายแล้วเก็บโต๊ะที่ยกเลิกและปิด QR เฉพาะโต๊ะนั้น", () => {
    const target = order("approved");
    const amount = recordRemovedSelections(target, ["A-02"], [], actor, "ขอลดหนึ่งโต๊ะ");
    target.tableIds = ["A-02"];
    assert.equal(amount, 4500);
    assert.equal(target.cancelledTables?.[0].id, "A-01");
    assert.deepEqual(target.ticketCodes, ["A-02-1-TEST"]);
    assert.deepEqual(target.cancelledTicketCodes, ["A-01-1-TEST"]);
  });
  it("ไม่ยอมยกเลิกรายการที่ใช้ตั๋วแล้ว", () => {
    const target = order("approved"); target.checkedInCodes.push("A-01-1-TEST");
    assert.throws(() => cancelEntireOrder(target, actor, "refund"), /ALREADY_USED/);
  });
  it("ไม่สร้างยอดคืนซ้ำเมื่อมีการคืนบางส่วนไปก่อน", () => {
    const target = order("approved");
    target.refunds = [{ id: "R-1", amount: 4500, reason: "partial", status: "refunded", requestedAt: now, itemIds: [], tableIds: ["A-01"] }];
    cancelEntireOrder(target, actor, "refund rest");
    assert.equal(target.refunds?.[1].amount, 4500);
  });
});

it("CSV เก็บสถานะอ่านใน Excel ได้และกันชื่อที่เป็นสูตร", () => {
  const target = order("cancelled");
  const data: DemoData = { users: [customer], sessions: [], products: [], zones: [], orders: [target], blockedTables: [], audit: [] };
  const csv = exportCustomerCsv(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /'\=SUM\(A1:A2\)/);
  assert.match(csv, /ยกเลิกแล้ว/);
});

it("CSV filters cancelled product lines separately from active lines", () => {
  const target: DemoOrder = {
    ...order("approved"), type: "product", tableIds: [], tablePrices: {},
    amount: 200, paidAmount: 300,
    items: [{ id: "line-1", productId: "shirt", name: "Shirt", quantity: 1, unitPrice: 100, optionId: "blue" }],
    cancelledItems: [{ id: "line-1", productId: "shirt", name: "Shirt", quantity: 1, unitPrice: 100, optionId: "blue", cancelledAt: now, cancelReason: "changed" }],
  };
  const data: DemoData = {
    users: [customer], sessions: [], zones: [], orders: [target], blockedTables: [], audit: [],
    products: [{ id: "shirt", name: "Shirt", description: "", price: 100, stock: 10, image: "", category: "shirt", sizes: ["Blue"], options: [{ id: "blue", label: "Blue" }], active: false, archived: true }],
  };
  const cancelled = exportCustomerCsv(data, { productId: "shirt", status: "cancelled" });
  const approved = exportCustomerCsv(data, { productId: "shirt", status: "approved" });
  assert.equal(cancelled.split("\r\n").length, 3);
  assert.equal(approved.split("\r\n").length, 3);
  assert.match(cancelled, /Blue/);
  assert.match(cancelled, /ยกเลิกแล้ว/);
  assert.ok(!exportCustomerCsv(data, { category: "mug" }).includes("O-1"));
});