import { closeDatabase } from "../lib/database-store";
import { databaseProvider } from "../lib/database-config";
import { migrateData, mutateData } from "../lib/demo-store";
async function main() {
  if (databaseProvider() === "file") throw new Error("DATABASE_URL is required");
  await mutateData((data) => { migrateData(data); });
  process.stdout.write("App records migrated; existing orders preserved.\n");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; }).finally(closeDatabase);
