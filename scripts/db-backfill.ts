import { closeDatabase } from "../lib/database-store";
import { databaseProvider } from "../lib/database-config";
import { migrateData, mutateData } from "../lib/demo-store";
async function main() {
  if (databaseProvider() === "file") throw new Error("Database configuration is required: set DB_DRIVER=mariadb, DB_NAME, DB_USER and DB_PASSWORD, or DATABASE_URL. For Plesk commands, configure .env.local in Application Root.");
  await mutateData((data) => { migrateData(data); });
  process.stdout.write("App records migrated; existing orders preserved.\n");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; }).finally(closeDatabase);
