import assert from "node:assert/strict";
import { it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { encryptSlip, decryptSlip, encryptedSlip } from "../lib/private-slips";
import { loginAllowed } from "../lib/login-limit";
import { createDemoData, migrateData, publicUser, snapshot, visibleOrder } from "../lib/demo-store";

it("encrypts slips with independent nonces and detects tampering", async () => {
  const previous = process.env.STORAGE_DIR;
  const root = await mkdtemp(path.join(os.tmpdir(), "sisat-crypto-test-"));
  try {
    process.env.STORAGE_DIR = root;
    const image = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from("private-financial-slip-image-data")]);
    const first = await encryptSlip(image);
    const second = await encryptSlip(image);
    assert.ok(encryptedSlip(first));
    assert.notDeepEqual(first, second);
    const damagedHeader = Buffer.from(second);
    damagedHeader[0] ^= 1;
    await assert.rejects(() => decryptSlip(damagedHeader));
    assert.ok(!first.includes(image));
    assert.deepEqual(await decryptSlip(first), image);
    first[first.length - 1] ^= 1;
    await assert.rejects(() => decryptSlip(first));
    assert.deepEqual(await decryptSlip(image), image); // Legacy compatibility until explicit migration.
  } finally {
    if (previous === undefined) delete process.env.STORAGE_DIR; else process.env.STORAGE_DIR = previous;
    if (!root.startsWith(os.tmpdir() + path.sep)) throw new Error("Unsafe temp path");
    await rm(root, { recursive: true, force: true });
  }
});
it("never serializes newly added user secrets or private order properties", () => {
  const data = migrateData(createDemoData());
  const customer = data.users.find((u) => u.username === "customer")!;
  const gate = data.users.find((u) => u.username === "gate")!;
  const order = data.orders[0];
  Object.assign(customer, { recoverySecret: "PRIVATE-RECOVERY-SECRET" });
  Object.assign(order, { internalBankCredentials: "PRIVATE-BANK-SECRET", cancelledTicketCodes: ["CANCELLED-SECRET-TICKET"] });
  assert.ok(!JSON.stringify(publicUser(customer)).includes("PRIVATE-"));
  const gateOrder = visibleOrder(data, order, gate)!;
  assert.ok(!JSON.stringify(gateOrder).includes("PRIVATE-"));
  assert.equal(gateOrder.cancelledTicketCodes, undefined);
  assert.equal(snapshot(data, null).orders.length, 0);
  assert.equal(snapshot(data, null).customers.length, 0);
  const stranger = { ...customer, id: "another-customer" };
  assert.equal(visibleOrder(data, order, stranger), null);
});
it("limits login attempts and reopens the window after the retry time", () => {
  const now = 1000;
  for (let i = 0; i < 12; i++) assert.equal(loginAllowed("test-limit-identity", now).allowed, true);
  const blocked = loginAllowed("TEST-LIMIT-IDENTITY", now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 60);
  assert.equal(loginAllowed("test-limit-identity", now + 60_001).allowed, true);
});

it("rejects a streamed request body over the limit without trusting Content-Length", async () => {
  const { readLimitedText, BodyTooLarge } = await import("../lib/request-body");
  const accepted = new Request("http://localhost/api/demo", { method: "POST", body: '{"action":"login"}' });
  assert.equal(await readLimitedText(accepted, 100), '{"action":"login"}');
  const rejected = new Request("http://localhost/api/demo", { method: "POST", body: "x".repeat(101) });
  await assert.rejects(() => readLimitedText(rejected, 100), BodyTooLarge);
});
