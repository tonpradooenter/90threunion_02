import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("การเข้าสู่ระบบบนเครื่อง Windows", () => {
  it("สร้างบัญชีทดลอง ตรวจรหัสผ่าน และบันทึก session ลงไฟล์ได้", async () => {
    const originalCwd = process.cwd();
    const temp = await mkdtemp(path.join(os.tmpdir(), "sisat-login-test-"));
    try {
      process.chdir(temp);
      const store = await import("../lib/demo-store");
      const initial = await store.readData();
      const customer = initial.users.find((user) => user.username === "customer");
      assert.ok(customer);
      assert.equal(initial.orders.length, 4);
      assert.deepEqual(initial.users.find((user) => user.username === "tableadmin")?.roles, ["tables", "merch"]);
      assert.equal(store.verifyPassword("Demo@1234", customer.passwordHash), true);
      await store.mutateData((data) => {
        data.sessions.push({ token: "test-session", userId: customer.id, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      });
      const after = await store.readData();
      assert.equal(store.currentUser(after, "test-session")?.username, "customer");
    } finally {
      process.chdir(originalCwd);
      if (!temp.startsWith(os.tmpdir() + path.sep)) throw new Error("Unsafe temp path");
      await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
