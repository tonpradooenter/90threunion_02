import { closePostgres } from "../lib/postgres-store";
import { migrateData, mutateData } from "../lib/demo-store";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await mutateData((data) => { migrateData(data); });
  process.stdout.write("PostgreSQL demo records backfilled.\n");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closePostgres);
