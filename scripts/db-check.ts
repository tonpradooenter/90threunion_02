import { closePostgres, readPostgresData } from "../lib/postgres-store";

async function main() {
  const data = await readPostgresData();
  process.stdout.write(`PostgreSQL ready: ${data.users.length} users, ${data.orders.length} orders, ${data.products.length} products.\n`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closePostgres);
