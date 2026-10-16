import { closeDatabase, readDatabaseData } from "../lib/database-store";
import { databaseProvider } from "../lib/database-config";
async function main() {
  if (databaseProvider() === "file") throw new Error("DATABASE_URL is required");
  const data = await readDatabaseData();
  process.stdout.write(`Database ready (${databaseProvider()}): ${data.users.length} users, ${data.orders.length} orders, ${data.products.length} products.\n`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Check failed"); process.exitCode = 1; }).finally(closeDatabase);
