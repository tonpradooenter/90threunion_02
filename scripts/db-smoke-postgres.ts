import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { closePostgres, ensurePostgresSchema, importPostgresData, mutatePostgresData, readPostgresData, searchPostgresCustomers } from "../lib/postgres-store";
import { migrateData } from "../lib/demo-store";
import type { DemoData } from "../lib/demo-types";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const databaseName = `sisat90_smoke_${randomBytes(5).toString("hex")}`;
  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const testUrl = new URL(process.env.DATABASE_URL);
    testUrl.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = testUrl.toString();
    await ensurePostgresSchema();
    const source = migrateData(JSON.parse(await readFile(path.join(process.cwd(), "data", "demo.json"), "utf8")) as DemoData);
    await importPostgresData(source);
    const initial = await readPostgresData();
    assert.equal(initial.users.length, source.users.length);
    assert.equal(initial.orders.length, source.orders.length);
    const matches = await searchPostgresCustomers("customer", 5);
    assert.ok(matches.some((entry) => entry.username === "customer"));
    const beforeAudit = initial.audit.length;
    await Promise.all([
      mutatePostgresData((data) => { data.audit.push({ at: new Date().toISOString(), actorId: "smoke", action: "parallel_a", detail: "" }); }),
      mutatePostgresData((data) => { data.audit.push({ at: new Date().toISOString(), actorId: "smoke", action: "parallel_b", detail: "" }); }),
    ]);
    const after = await readPostgresData();
    assert.equal(after.audit.length, beforeAudit + 2);
    assert.ok(after.audit.some((entry) => entry.action === "parallel_a"));
    assert.ok(after.audit.some((entry) => entry.action === "parallel_b"));
    process.stdout.write(`PostgreSQL smoke passed: ${after.users.length} users, ${after.orders.length} orders, concurrent writes persisted.\n`);
  } finally {
    await closePostgres();
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });