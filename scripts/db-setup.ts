import { readFile } from "node:fs/promises";
import { closeDatabase, ensureDatabaseSchema, importDatabaseData, readDatabaseData } from "../lib/database-store";
import { databaseProvider } from "../lib/database-config";
import { createDemoData, migrateData } from "../lib/demo-store";
import type { DemoData } from "../lib/demo-types";

async function main() {
  if (databaseProvider() === "file") throw new Error("Database configuration is required: set DB_DRIVER=mariadb, DB_NAME, DB_USER and DB_PASSWORD, or DATABASE_URL. For Plesk commands, configure .env.local in Application Root.");
  await ensureDatabaseSchema();
  const existing = await readDatabaseData();
  if (existing.users.length || existing.orders.length) {
    process.stdout.write("Database already contains app data; seed skipped. Existing data was preserved.\n");
    return;
  }
  // Import a file only when explicitly requested; never silently upload local users/slips.
  const sourceFile = process.argv.find((arg) => arg.startsWith("--import-json="))?.slice(14);
  const source = migrateData(sourceFile
    ? JSON.parse(await readFile(sourceFile, "utf8")) as DemoData
    : createDemoData());
  source.sessions = [];
  await importDatabaseData(source);
  process.stdout.write(`Database setup complete (${databaseProvider()}): ${source.users.length} demo accounts, ${source.orders.length} sample orders.\n`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Setup failed"); process.exitCode = 1; }).finally(closeDatabase);
