import type { DemoData } from "./demo-types";
import { databaseProvider } from "./database-config";
import { closeMaria, ensureMariaSchema, importMariaData, mutateMariaData, readMariaData, searchMariaCustomers, touchMariaSession } from "./mariadb-store";
import { closePostgres, ensurePostgresSchema, importPostgresData, mutatePostgresData, readPostgresData, searchPostgresCustomers, touchPostgresSession } from "./postgres-store";

const maria = () => databaseProvider() === "mariadb";
export const ensureDatabaseSchema = () => maria() ? ensureMariaSchema() : ensurePostgresSchema();
export const readDatabaseData = () => maria() ? readMariaData() : readPostgresData();
export const importDatabaseData = (data: DemoData) => maria() ? importMariaData(data) : importPostgresData(data);
export function mutateDatabaseData<T>(fn: (data: DemoData) => Promise<T> | T): Promise<T> {
  return maria() ? mutateMariaData(fn) : mutatePostgresData(fn);
}
export const searchDatabaseCustomers = (query: string, limit = 50, offset = 0) =>
  maria() ? searchMariaCustomers(query, limit, offset) : searchPostgresCustomers(query, limit, offset);
export const touchDatabaseSession = (token: string) => maria() ? touchMariaSession(token) : touchPostgresSession(token);
export async function closeDatabase(): Promise<void> { await Promise.all([closeMaria(), closePostgres()]); }
