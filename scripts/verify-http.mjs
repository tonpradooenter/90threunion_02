// CI/local opt-in smoke: opens a temporary server, then closes it and drops ONLY owned sisat_test_* tables.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import mariadb from "mariadb";
import sharp from "sharp";
import ExcelJS from "exceljs";

const raw = process.env.TEST_DATABASE_URL;
if (!raw) throw new Error("TEST_DATABASE_URL is required");
const url = new URL(raw);
if (!url.pathname.slice(1).startsWith("sisat_test_")) throw new Error("HTTP smoke requires an EMPTY sisat_test_* database");
const conn = await mariadb.createConnection({
  host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)),
});
let owned = false;
let server;
let logs = "";
const storage = await mkdtemp(path.join(os.tmpdir(), "sisat-http-test-"));
try {
  assert.equal((await conn.query("SHOW TABLES")).length, 0, "Test database must be empty");
  owned = true;
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
  const origin = `http://127.0.0.1:${port}`;
  const password = randomBytes(24).toString("hex");
  const env = { ...process.env, DATABASE_URL: raw, DEMO_PASSWORD: password, STORAGE_DIR: storage, NODE_ENV: "production", APP_ORIGIN: origin, PORT: String(port) };
  const seeded = spawnSync(process.execPath, ["--import", "tsx", "scripts/db-setup.ts"], { env, encoding: "utf8" });
  assert.equal(seeded.status, 0, seeded.stderr);
  server = spawn(process.execPath, ["app.cjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Temporary server exited: " + logs);
    try { const res = await fetch(origin + "/api/health", { signal: AbortSignal.timeout(1000) }); if (res.ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Temporary server startup timed out: " + logs);
  const request = (cookie, action, payload = {}) => fetch(origin + "/api/demo", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const act = async (cookie, action, payload = {}) => {
    const res = await request(cookie, action, payload); const body = await res.json();
    assert.equal(res.status, 200, `${action}: ${body.error || res.status}`); return body;
  };
  const login = async (username) => {
    const res = await request("", "login", { username, password });
    assert.equal(res.status, 200, "Login failed: " + username);
    assert.ok(res.headers.get("set-cookie")?.includes("HttpOnly"));
    return res.headers.get("set-cookie").split(";")[0];
  };
  for (const filename of ["/.env.local", "/.git/config", "/package.json", "/sisat90-v1.0.0-hostatom-source.zip"]) {
    const response = await fetch(origin + filename);
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes(password));
  }
  const guest = await (await fetch(origin + "/api/demo")).json();
  assert.deepEqual(guest.orders, []);
  assert.deepEqual(guest.users, []);
  assert.deepEqual(guest.customers, []);
  assert.ok(!JSON.stringify(guest).includes("passwordHash"));
  const pageHeaders = await fetch(origin);
  assert.ok(pageHeaders.headers.get("content-security-policy")?.includes("object-src 'none'"));
  assert.ok(pageHeaders.headers.get("strict-transport-security"));
  const cookies = {};
  for (const username of ["customer", "superadmin", "tableadmin", "shopadmin", "finance", "gate"]) cookies[username] = await login(username);
  const snapshot = async (cookie) => (await fetch(origin + "/api/demo", { headers: { Cookie: cookie } })).json();
  assert.equal((await request(cookies.finance, "saveZone", { id: "A", price: 1 })).status, 403);
  assert.equal((await request(cookies.customer, "setRoles", {})).status, 403);

  const attempts = await Promise.all(Array.from({ length: 30 }, () => request(cookies.customer, "createOrder", {
    type: "table", tableIds: ["J-60"], meal: "ชุดอาหารมาตรฐาน", dietaryNotes: "แพ้กุ้ง",
  })));
  assert.equal(attempts.filter((res) => res.status === 200).length, 1);
  assert.equal(attempts.filter((res) => res.status === 400).length, 29);
  const order = (await attempts.find((res) => res.status === 200).json()).order;
  assert.ok(Date.parse(order.holdUntil) > Date.now());

  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 30, g: 70, b: 130, alpha: 1 } } }).png().toBuffer();
  const slips = (count, bytes = png) => {
    const form = new FormData(); form.set("orderId", order.id);
    for (let i = 0; i < count; i++) form.append("files", new Blob([bytes], { type: "image/png" }), `slip-${i}.png`);
    return fetch(origin + "/api/slip", { method: "POST", headers: { Cookie: cookies.customer, Origin: origin }, body: form });
  };
  assert.equal((await slips(4)).status, 400);
  assert.equal((await slips(1, Buffer.alloc(5_000_001))).status, 400);
  assert.equal((await slips(3)).status, 200);
  const review = (await snapshot(cookies.customer)).orders.find((o) => o.id === order.id);
  assert.equal(review.slips.length, 3);
  const saved = await readFile(path.join(storage, "slips", review.slips[0].filename));
  assert.equal(saved.subarray(0, 12).toString(), "SISAT-SLIP-1");
  assert.ok(!saved.equals(png));
  const slipPath = "/api/slip?orderId=" + encodeURIComponent(order.id) + "&slipId=" + review.slips[0].id;
  assert.equal((await fetch(origin + slipPath)).status, 401);
  assert.equal((await fetch(origin + slipPath, { headers: { Cookie: cookies.shopadmin } })).status, 403);
  assert.equal((await fetch(origin + slipPath, { headers: { Cookie: cookies.finance } })).status, 200);
  const approvedResult = await act(cookies.finance, "reviewOrder", { orderId: order.id, decision: "approve", comment: "" });
  assert.deepEqual(approvedResult.order.ticketCodes, []);
  assert.equal(approvedResult.order.dietaryNotes, "");
  assert.deepEqual((await snapshot(cookies.gate)).orders.find((o) => o.id === order.id).ticketCodes, []);
  assert.equal((await snapshot(cookies.shopadmin)).orders.find((o) => o.id === order.id).slips, undefined);
  const paid = (await snapshot(cookies.customer)).orders.find((o) => o.id === order.id);
  assert.equal(paid.ticketCodes.length, 8);
  await act(cookies.gate, "scanTicket", { code: paid.ticketCodes[0] });
  assert.equal((await request(cookies.gate, "scanTicket", { code: paid.ticketCodes[0] })).status, 400);

  const imageForm = new FormData(); imageForm.set("file", new Blob([png], { type: "image/png" }), "product.png");
  const imageRes = await fetch(origin + "/api/product-image", { method: "POST", headers: { Cookie: cookies.shopadmin, Origin: origin }, body: imageForm });
  assert.equal(imageRes.status, 200);
  const image = await imageRes.json();
  assert.equal((await fetch(origin + image.path)).status, 200);

  assert.equal((await request(cookies.customer, "cancelOrder", { orderId: "DEMO-PRODUCT-PAID" })).status, 400);
  await act(cookies.shopadmin, "cancelAssistedOrder", { orderId: "DEMO-PRODUCT-PAID", reason: "Customer requested cancellation through staff" });
  const cancelled = (await snapshot(cookies.customer)).orders.find((o) => o.id === "DEMO-PRODUCT-PAID");
  assert.equal(cancelled.status, "refund_pending");
  await act(cookies.finance, "completeRefund", { orderId: cancelled.id, refundId: cancelled.refunds[0].id, reference: "CI-REFUND-1" });
  assert.equal((await snapshot(cookies.customer)).orders.find((o) => o.id === cancelled.id).status, "refunded");

  const exported = await fetch(origin + "/api/export", { headers: { Cookie: cookies.finance } });
  assert.equal(exported.status, 200);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer()));
  assert.ok(workbook.worksheets[0].rowCount > 1);
  assert.ok(workbook.worksheets[0].autoFilter);
  const strangerResult = await request("", "register", { username: "other_customer", displayName: "Other Customer", password });
  assert.equal(strangerResult.status, 200);
  const strangerCookie = strangerResult.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(origin + slipPath, { headers: { Cookie: strangerCookie } })).status, 403);
  assert.equal((await snapshot(strangerCookie)).orders.length, 0);
  assert.equal((await request(strangerCookie, "cancelOrder", { orderId: order.id })).status, 403);
  assert.equal((await fetch(origin + "/api/export", { headers: { Cookie: strangerCookie } })).status, 403);
  assert.equal((await fetch(origin + "/api/staff/customers", { headers: { Cookie: strangerCookie } })).status, 403);
  const csrf = await fetch(origin + "/api/demo", { method: "POST", headers: { Cookie: cookies.superadmin, Origin: "https://attacker.invalid", "Content-Type": "application/json" }, body: JSON.stringify({ action: "setRoles" }) });
  assert.equal(csrf.status, 403);
  for (let i = 0; i < 12; i++) assert.equal((await request("", "login", { username: "rate_probe", password: "incorrect" })).status, 401);
  const throttled = await request("", "login", { username: "rate_probe", password: "incorrect" });
  assert.equal(throttled.status, 429); assert.ok(throttled.headers.get("retry-after"));

  // The update migrates legacy uploads without touching orders or requiring a fresh database.
  const legacy = review.slips[1].filename;
  await writeFile(path.join(storage, "slips", legacy), png);
  const migrated = spawnSync(process.execPath, ["--import", "tsx", "scripts/security-migrate.ts"], { env, encoding: "utf8" });
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.ok(!(await readFile(path.join(storage, "slips", legacy))).equals(png));
  assert.ok(Buffer.from(await (await fetch(origin + slipPath, { headers: { Cookie: cookies.finance } })).arrayBuffer()).equals(png));
  if (process.env.RUN_BROWSER_TESTS === "1") {
    const { verifyResponsive } = await import("./verify-responsive.mjs");
    await verifyResponsive(origin, cookies.customer);
  }
  console.log("HTTP smoke passed: six roles, 30 competing bookings, slip limits/privacy, ticket reuse, product upload, refund and XLSX.");
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (server.exitCode === null) { server.kill("SIGKILL"); await exited; }
  }
  if (owned) for (const name of ["sisat_sessions", "sisat_orders", "sisat_products", "sisat_zones", "sisat_blocked_tables", "sisat_audit", "sisat_settings", "sisat_write_lock", "sisat_users"]) await conn.query(`DROP TABLE IF EXISTS ${name}`);
  await conn.end();
  if (storage.startsWith(os.tmpdir() + path.sep)) await rm(storage, { recursive: true, force: true, maxRetries: 5 });
}
