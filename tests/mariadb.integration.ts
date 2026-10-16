import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import mariadb, { type Connection } from "mariadb";
import { closeMaria, ensureMariaSchema, importMariaData, mutateMariaData, readMariaData, searchMariaCustomers, touchMariaSession } from "../lib/mariadb-store";
import { activeOrder, createDemoData, migrateData, verifyPassword } from "../lib/demo-store";
import { cancelEntireOrder, completeRefund } from "../lib/order-workflow";
import type { DemoOrder } from "../lib/demo-types";

let admin: Connection;
let owned = false;
before(async () => {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required; use a dedicated EMPTY sisat_test_* database.");
  const url = new URL(value);
  if (!url.pathname.slice(1).startsWith("sisat_test_")) throw new Error("Refusing integration tests outside a sisat_test_* database");
  process.env.DATABASE_URL = value;
  admin = await mariadb.createConnection({
    host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)), timezone: "+00:00",
  });
  const tables = await admin.query("SHOW TABLES");
  if (tables.length) throw new Error("Integration database must be empty; no existing tables will be overwritten.");
  owned = true;
  await ensureMariaSchema();
  await importMariaData(migrateData(createDemoData("IntegrationOnly@12345")));
});
after(async () => {
  await closeMaria();
  if (admin && owned) {
    for (const name of ["sisat_sessions", "sisat_orders", "sisat_products", "sisat_zones", "sisat_blocked_tables", "sisat_audit", "sisat_settings", "sisat_write_lock", "sisat_users"]) {
      await admin.query(`DROP TABLE IF EXISTS ${name}`);
    }
  }
  await admin?.end();
});

describe("MariaDB v1", { concurrency: false }, () => {
  it("seeds Thai text, stable options and settings; never replaces existing accounts", async () => {
    const data = await readMariaData();
    assert.equal(data.users.length, 6);
    assert.equal(data.orders.length, 4);
    assert.equal(data.settings?.tableHoldMinutes, 60);
    assert.ok(data.products[0].options?.length);
    assert.ok(data.users.some((user) => /[ก-๙]/.test(user.displayName)));
    assert.ok(verifyPassword("IntegrationOnly@12345", data.users[0].passwordHash));
    await assert.rejects(importMariaData(migrateData(createDemoData("OtherPassword@1234"))), /not empty/);
  });

  it("rolls back all changes when a duplicate username is attempted", async () => {
    const before = await readMariaData();
    await assert.rejects(mutateMariaData((data) => {
      data.audit.push({ at: new Date().toISOString(), actorId: "test", action: "must_rollback", detail: "" });
      data.users.push({ ...data.users[0], id: randomUUID() });
    }));
    const after = await readMariaData();
    assert.deepEqual(after.users, before.users);
    assert.deepEqual(after.audit, before.audit);
  });

  it("30 concurrent reservations of one table produce exactly one winner", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 30 }, (_, index) => mutateMariaData((data) => {
      if (data.orders.some((order) => activeOrder(order) && order.tableIds.includes("J-60"))) throw new Error("already reserved");
      const order: DemoOrder = {
        id: `RACE-TABLE-${index}`, userId: data.users.find((u) => u.username === "customer")!.id,
        type: "table", status: "awaiting_slip", tableIds: ["J-60"], items: [],
        meal: "อาหารมาตรฐาน", dietaryNotes: "", amount: 2900, createdAt: new Date().toISOString(),
        holdUntil: new Date(Date.now() + 3600_000).toISOString(), ticketCodes: [], checkedInCodes: [],
      };
      data.orders.push(order);
    })));
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await readMariaData()).orders.filter((o) => o.tableIds.includes("J-60")).length, 1);
  });

  it("30 simultaneous requests cannot oversell five remaining products", async () => {
    await mutateMariaData((data) => {
      data.products.push({ id: "race-product", name: "ทดสอบสต็อก", description: "", price: 100, stock: 5, image: "", category: "แก้วน้ำ", sizes: [], active: true });
    });
    const attempts = await Promise.allSettled(Array.from({ length: 30 }, (_, index) => mutateMariaData((data) => {
      const used = data.orders.filter(activeOrder).flatMap((o) => o.items).filter((i) => i.productId === "race-product").reduce((sum, i) => sum + i.quantity, 0);
      if (used >= 5) throw new Error("sold out");
      data.orders.push({
        id: `RACE-PRODUCT-${index}`, userId: data.users.find((u) => u.username === "customer")!.id,
        type: "product", status: "awaiting_slip", tableIds: [], items: [{ productId: "race-product", name: "ทดสอบสต็อก", quantity: 1, unitPrice: 100 }],
        meal: "", dietaryNotes: "", amount: 100, createdAt: new Date().toISOString(),
        holdUntil: new Date(Date.now() + 3600_000).toISOString(), ticketCodes: [], checkedInCodes: [],
      });
    })));
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 5);
  });

  it("searches Thai names/phones and treats % and _ literally", async () => {
    await mutateMariaData((data) => {
      const customer = data.users.find((u) => u.username === "customer")!;
      customer.displayName = "สมชาย 50%_";
      customer.phone = "0812345678";
    });
    assert.equal((await searchMariaCustomers("สมชาย"))[0].username, "customer");
    assert.equal((await searchMariaCustomers("081234"))[0].username, "customer");
    assert.equal((await searchMariaCustomers("%_")).length, 1);
    assert.equal((await searchMariaCustomers("not_found")).length, 0);
  });

  it("honors idle session expiry in SQL and retains concurrent heartbeats", async () => {
    await mutateMariaData((data) => {
      const userId = data.users.find((u) => u.username === "customer")!.id;
      data.sessions.push(
        { token: "active-test", userId, expiresAt: new Date(Date.now() + 3600_000).toISOString(), lastActiveAt: new Date(Date.now() - 1000).toISOString() },
        { token: "idle-test", userId, expiresAt: new Date(Date.now() + 3600_000).toISOString(), lastActiveAt: new Date(Date.now() - 600_000).toISOString() },
      );
    });
    assert.equal(await touchMariaSession("idle-test"), false);
    assert.equal(await touchMariaSession("active-test"), true);
    const at = (await readMariaData()).sessions.find((s) => s.token === "active-test")!.lastActiveAt;
    assert.ok(Math.abs(Date.now() - Date.parse(at!)) < 5000);
    let release!: () => void;
    let observed!: () => void;
    const ready = new Promise<void>((resolve) => { observed = resolve; });
    const pause = new Promise<void>((resolve) => { release = resolve; });
    const write = mutateMariaData(async (data) => {
      observed(); await pause;
      data.audit.push({ at: new Date().toISOString(), actorId: "test", action: "concurrent_heartbeat", detail: "" });
    });
    await ready;
    await new Promise((resolve) => setTimeout(resolve, 20));
    try {
      assert.equal(await touchMariaSession("active-test"), true);
    } finally { release(); }
    await write;
    const refreshed = (await readMariaData()).sessions.find((s) => s.token === "active-test")!.lastActiveAt;
    assert.ok(Date.parse(refreshed!) > Date.parse(at!));
  });

  it("keeps paid cancellation history and completes a refund without reviving the order", async () => {
    await mutateMariaData((data) => {
      const order = data.orders.find((o) => o.id === "DEMO-PRODUCT-PAID")!;
      const actor = data.users.find((u) => u.username === "superadmin")!;
      cancelEntireOrder(order, actor, "ลูกค้าขอยกเลิก");
      assert.equal(order.status, "refund_pending");
    });
    const cancelled = (await readMariaData()).orders.find((o) => o.id === "DEMO-PRODUCT-PAID")!;
    assert.equal(cancelled.items[0].quantity, 1);
    assert.equal(cancelled.refunds?.[0].amount, 790);
    await mutateMariaData((data) => {
      const order = data.orders.find((o) => o.id === cancelled.id)!;
      completeRefund(order, order.refunds![0].id, data.users.find((u) => u.username === "finance")!, "TEST-REFUND-1");
    });
    const order = (await readMariaData()).orders.find((o) => o.id === cancelled.id)!;
    assert.equal(order.status, "refunded");
    assert.equal(order.refunds?.[0].reference, "TEST-REFUND-1");
    assert.equal(activeOrder(order), false);
  });
});
