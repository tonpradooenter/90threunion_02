import { Pool, type PoolClient } from "pg";
import type { DemoData, DemoOrder, DemoUser, Product, Zone, AuditEntry } from "./demo-types";

let pool: Pool | undefined;
function database(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL storage");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 12, idleTimeoutMillis: 30_000 });
  return pool;
}

export async function ensurePostgresSchema(): Promise<void> {
  await database().query(`
    CREATE TABLE IF NOT EXISTS sisat_users (
      id text PRIMARY KEY, username text NOT NULL UNIQUE, display_name text NOT NULL,
      phone text, position integer NOT NULL, data jsonb NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sisat_users_phone_unique ON sisat_users (phone) WHERE phone IS NOT NULL AND phone <> '';
    CREATE INDEX IF NOT EXISTS sisat_users_name_search ON sisat_users (lower(display_name));
    CREATE TABLE IF NOT EXISTS sisat_products (id text PRIMARY KEY, position integer NOT NULL, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS sisat_zones (id text PRIMARY KEY, position integer NOT NULL, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS sisat_orders (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES sisat_users(id) ON DELETE RESTRICT,
      status text NOT NULL, type text NOT NULL, created_at timestamptz NOT NULL,
      position integer NOT NULL, data jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sisat_orders_customer_date ON sisat_orders (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS sisat_orders_status_date ON sisat_orders (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS sisat_orders_type_date ON sisat_orders (type, created_at DESC);
    CREATE TABLE IF NOT EXISTS sisat_sessions (
      token text PRIMARY KEY, user_id text NOT NULL REFERENCES sisat_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL, last_active_at timestamptz
    );
    ALTER TABLE sisat_sessions ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
    UPDATE sisat_sessions SET last_active_at = expires_at - interval '12 hours' WHERE last_active_at IS NULL;
    CREATE INDEX IF NOT EXISTS sisat_sessions_expiry ON sisat_sessions (expires_at);
    CREATE TABLE IF NOT EXISTS sisat_blocked_tables (id text PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS sisat_audit (id bigserial PRIMARY KEY, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS sisat_settings (key text PRIMARY KEY, value jsonb NOT NULL);
  `);
}

async function readFrom(client: PoolClient): Promise<DemoData> {
  const users = await client.query("SELECT data FROM sisat_users ORDER BY position, id");
  const products = await client.query("SELECT data FROM sisat_products ORDER BY position, id");
  const zones = await client.query("SELECT data FROM sisat_zones ORDER BY position, id");
  const orders = await client.query("SELECT data FROM sisat_orders ORDER BY position, id");
  const sessions = await client.query("SELECT token, user_id, expires_at, last_active_at FROM sisat_sessions");
  const blocked = await client.query("SELECT id FROM sisat_blocked_tables ORDER BY id");
  const audit = await client.query("SELECT data FROM sisat_audit ORDER BY id");
  const settings = await client.query("SELECT key, value FROM sisat_settings");
  const value = new Map<string, unknown>(settings.rows.map((entry) => [entry.key, entry.value]));
  return {
    users: users.rows.map((entry) => entry.data as DemoUser),
    products: products.rows.map((entry) => entry.data as Product),
    zones: zones.rows.map((entry) => entry.data as Zone),
    orders: orders.rows.map((entry) => entry.data as DemoOrder),
    sessions: sessions.rows.map((entry) => ({ token: entry.token as string, userId: entry.user_id as string, expiresAt: new Date(entry.expires_at).toISOString(), lastActiveAt: entry.last_active_at ? new Date(entry.last_active_at).toISOString() : undefined })),
    blockedTables: blocked.rows.map((entry) => entry.id as string),
    audit: audit.rows.map((entry) => entry.data as AuditEntry),
    schemaVersion: Number(value.get("schemaVersion") ?? 0),
    categories: Array.isArray(value.get("categories")) ? value.get("categories") as string[] : undefined,
    settings: value.get("eventSettings") as DemoData["settings"],
    brandingHistory: value.get("brandingHistory") as DemoData["brandingHistory"],
  };
}

export async function readPostgresData(): Promise<DemoData> {
  const client = await database().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data = await readFrom(client);
    await client.query("COMMIT");
    return data;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

const changed = (before: unknown, after: unknown) => JSON.stringify(before) !== JSON.stringify(after);

async function persist(client: PoolClient, before: DemoData, after: DemoData): Promise<void> {
  const oldUsers = new Map(before.users.map((entry) => [entry.id, entry]));
  for (const [position, user] of after.users.entries()) {
    if (!changed(oldUsers.get(user.id), user) && before.users.findIndex((entry) => entry.id === user.id) === position) continue;
    await client.query(`INSERT INTO sisat_users(id, username, display_name, phone, position, data)
      VALUES($1,$2,$3,$4,$5,$6::jsonb)
      ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username, display_name=EXCLUDED.display_name,
      phone=EXCLUDED.phone, position=EXCLUDED.position, data=EXCLUDED.data`,
      [user.id, user.username, user.displayName, user.phone || null, position, JSON.stringify(user)]);
  }
  const oldProducts = new Map(before.products.map((entry) => [entry.id, entry]));
  for (const [position, product] of after.products.entries()) {
    if (!changed(oldProducts.get(product.id), product) && before.products.findIndex((entry) => entry.id === product.id) === position) continue;
    await client.query(`INSERT INTO sisat_products(id,position,data) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(id) DO UPDATE SET position=EXCLUDED.position,data=EXCLUDED.data`, [product.id, position, JSON.stringify(product)]);
  }
  const oldZones = new Map(before.zones.map((entry) => [entry.id, entry]));
  for (const [position, zone] of after.zones.entries()) {
    if (!changed(oldZones.get(zone.id), zone) && before.zones.findIndex((entry) => entry.id === zone.id) === position) continue;
    await client.query(`INSERT INTO sisat_zones(id,position,data) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(id) DO UPDATE SET position=EXCLUDED.position,data=EXCLUDED.data`, [zone.id, position, JSON.stringify(zone)]);
  }
  const oldOrders = new Map(before.orders.map((entry) => [entry.id, entry]));
  for (const [position, order] of after.orders.entries()) {
    if (!changed(oldOrders.get(order.id), order) && before.orders.findIndex((entry) => entry.id === order.id) === position) continue;
    await client.query(`INSERT INTO sisat_orders(id,user_id,status,type,created_at,position,data)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
      ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,status=EXCLUDED.status,type=EXCLUDED.type,
      created_at=EXCLUDED.created_at,position=EXCLUDED.position,data=EXCLUDED.data`,
      [order.id, order.userId, order.status, order.type, order.createdAt, position, JSON.stringify(order)]);
  }
  for (const id of oldOrders.keys()) if (!after.orders.some((order) => order.id === id)) await client.query("DELETE FROM sisat_orders WHERE id=$1", [id]);
  for (const id of oldProducts.keys()) if (!after.products.some((product) => product.id === id)) await client.query("DELETE FROM sisat_products WHERE id=$1", [id]);
  for (const id of oldUsers.keys()) if (!after.users.some((user) => user.id === id)) await client.query("DELETE FROM sisat_users WHERE id=$1", [id]);
  for (const id of oldZones.keys()) if (!after.zones.some((zone) => zone.id === id)) await client.query("DELETE FROM sisat_zones WHERE id=$1", [id]);
  const oldSessions = new Map(before.sessions.map((entry) => [entry.token, entry]));
  for (const session of after.sessions) {
    if (!changed(oldSessions.get(session.token), session)) continue;
    await client.query(`INSERT INTO sisat_sessions(token,user_id,expires_at,last_active_at) VALUES($1,$2,$3,$4)
      ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,expires_at=EXCLUDED.expires_at,last_active_at=EXCLUDED.last_active_at`,
      [session.token, session.userId, session.expiresAt, session.lastActiveAt ?? session.expiresAt]);
  }
  for (const token of oldSessions.keys()) if (!after.sessions.some((entry) => entry.token === token)) await client.query("DELETE FROM sisat_sessions WHERE token=$1", [token]);
  if (changed(before.blockedTables, after.blockedTables)) {
    await client.query("DELETE FROM sisat_blocked_tables");
    for (const id of after.blockedTables) await client.query("INSERT INTO sisat_blocked_tables(id) VALUES($1)", [id]);
  }
  if (changed(before.audit, after.audit)) {
    await client.query("DELETE FROM sisat_audit");
    for (const entry of after.audit) await client.query("INSERT INTO sisat_audit(data) VALUES($1::jsonb)", [JSON.stringify(entry)]);
  }
  if (before.schemaVersion !== after.schemaVersion || changed(before.categories, after.categories) || changed(before.settings, after.settings) || changed(before.brandingHistory, after.brandingHistory)) {
    await client.query("INSERT INTO sisat_settings(key,value) VALUES('schemaVersion',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(after.schemaVersion ?? 0)]);
    await client.query("INSERT INTO sisat_settings(key,value) VALUES('categories',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(after.categories ?? [])]);
    await client.query("INSERT INTO sisat_settings(key,value) VALUES('eventSettings',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(after.settings ?? {})]);
    await client.query("INSERT INTO sisat_settings(key,value) VALUES('brandingHistory',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(after.brandingHistory ?? [])]);
  }
}

export async function mutatePostgresData<T>(fn: (data: DemoData) => Promise<T> | T): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(900290)");
    const data = await readFrom(client);
    const before = structuredClone(data);
    const result = await fn(data);
    await persist(client, before, data);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function importPostgresData(data: DemoData): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(900290)");
    const before = await readFrom(client);
    if (before.users.length || before.orders.length) throw new Error("Database is not empty; import stopped to protect existing data");
    await persist(client, before, data);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function closePostgres(): Promise<void> { if (pool) { await pool.end(); pool = undefined; } }
export async function searchPostgresCustomers(query: string, limit = 50, offset = 0): Promise<{ id: string; displayName: string; username: string; phone?: string; orderCount: number }[]> {
  const term = `%${query.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const result = await database().query(`SELECT u.id, u.display_name, u.username, u.phone, count(o.id)::integer AS order_count
    FROM sisat_users u LEFT JOIN sisat_orders o ON o.user_id=u.id
    WHERE u.data->>'role'='customer' AND u.data->>'active'='true'
      AND ($1='' OR u.display_name ILIKE $2 ESCAPE '\\' OR u.username ILIKE $2 ESCAPE '\\' OR coalesce(u.phone,'') ILIKE $2 ESCAPE '\\' OR u.id ILIKE $2 ESCAPE '\\')
    GROUP BY u.id ORDER BY u.display_name, u.id LIMIT $3 OFFSET $4`, [query.trim(), term, Math.min(limit, 100), Math.max(0, offset)]);
  return result.rows.map((row) => ({ id: row.id, displayName: row.display_name, username: row.username, phone: row.phone ?? undefined, orderCount: row.order_count }));
}

export async function touchPostgresSession(token: string): Promise<boolean> {
  const result = await database().query(`
    UPDATE sisat_sessions s SET last_active_at=now()
    FROM sisat_users u
    WHERE s.token=$1 AND u.id=s.user_id AND u.data->>'active'='true'
      AND s.expires_at > now()
      AND s.last_active_at > now() - (
        coalesce((SELECT (value->>'idleSeconds')::integer FROM sisat_settings WHERE key='eventSettings'),300) * interval '1 second'
      )
    RETURNING s.token`, [token]);
  return result.rowCount === 1;
}