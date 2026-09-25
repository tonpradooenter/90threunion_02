import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePostgres, ensurePostgresSchema, importPostgresData, readPostgresData } from "../lib/postgres-store";
import { migrateData } from "../lib/demo-store";
import type { DemoData } from "../lib/demo-types";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing from .env.local");
  await ensurePostgresSchema();
  const existing = await readPostgresData();
  if (existing.users.length || existing.orders.length) {
    process.stdout.write(`Database already contains ${existing.users.length} users and ${existing.orders.length} orders; import skipped.\n`);
    return;
  }
  const file = path.join(process.cwd(), "data", "demo.json");
  const source = migrateData(JSON.parse(await readFile(file, "utf8")) as DemoData);
  await importPostgresData(source);
  process.stdout.write(`Imported ${source.users.length} users, ${source.products.length} products and ${source.orders.length} orders.\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closePostgres);
