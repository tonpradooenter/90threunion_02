import assert from "node:assert/strict";
import { it } from "node:test";
import { databaseProvider } from "../lib/database-config";
import { storagePath } from "../lib/storage";
import { sameOrigin } from "../lib/request-origin";

it("pins the public origin through Plesk and rejects a spoofed forwarded host", () => {
  const before = process.env.APP_ORIGIN;
  try {
    process.env.APP_ORIGIN = "https://90reunion.tonpradoo.com";
    const req = (origin: string) => new Request("http://127.0.0.1/api/demo", { headers: { origin, "x-forwarded-host": "attacker.example" } });
    assert.equal(sameOrigin(req("https://90reunion.tonpradoo.com")), true);
    assert.equal(sameOrigin(req("https://tonpradoo.com")), false);
    assert.equal(sameOrigin(req("https://attacker.example")), false);
  } finally {
    if (before === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = before;
  }
});

it("does not silently use JSON storage on a production deployment", () => {
  const before = { url: process.env.DATABASE_URL, mode: process.env.NODE_ENV };
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production"; delete process.env.DATABASE_URL;
    assert.throws(databaseProvider, /required/);
    process.env.DATABASE_URL = "mariadb://user:example@localhost/demo";
    assert.equal(databaseProvider(), "mariadb");
    process.env.DATABASE_URL = "postgresql://user:example@localhost/demo";
    assert.equal(databaseProvider(), "postgres");
    process.env.DATABASE_URL = "file:///tmp/db";
    assert.throws(databaseProvider, /must use/);
  } finally {
    for (const [key, value] of Object.entries({ DATABASE_URL: before.url, NODE_ENV: before.mode })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

it("rejects private storage inside the public document root", () => {
  const before = process.env.STORAGE_DIR;
  try {
    process.env.STORAGE_DIR = "public/slips";
    assert.throws(() => storagePath("secret.jpg"), /outside/);
  } finally {
    if (before === undefined) delete process.env.STORAGE_DIR; else process.env.STORAGE_DIR = before;
  }
});


it("accepts separate Plesk DB fields and refuses a shared production seed password", async () => {
  const keys = ["DATABASE_URL", "DB_DRIVER", "DB_NAME", "DB_USER", "NODE_ENV"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.DATABASE_URL;
    process.env.DB_DRIVER = "mariadb"; process.env.DB_NAME = "test_db"; process.env.DB_USER = "test_user";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    assert.equal(databaseProvider(), "mariadb");
    const { createDemoData, verifyPassword } = await import("../lib/demo-store");
    assert.throws(() => createDemoData("Demo@1234"), /unique/);
    assert.throws(() => createDemoData("CHANGE_THIS_BEFORE_SEEDING"), /unique/);
    const seed = createDemoData("OnlyForThisTest@1234");
    assert.ok(verifyPassword("OnlyForThisTest@1234", seed.users[0].passwordHash));
    assert.ok(!JSON.stringify(seed).includes("OnlyForThisTest@1234"));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
