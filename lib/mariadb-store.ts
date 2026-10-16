import mariadb, { type Pool, type PoolConnection } from "mariadb";
import type { DemoData, DemoOrder, DemoUser, Product, Zone, AuditEntry } from "./demo-types";
import { databaseConnectionLimit } from "./database-config";

const shared = globalThis as typeof globalThis & { sisatMariaPool?: Pool };
let pool: Pool | undefined;
function database(): Pool {
  if (shared.sisatMariaPool) return shared.sisatMariaPool;
  const raw = process.env.DATABASE_URL;
  const url = raw ? new URL(raw) : undefined;
  const name = url ? decodeURIComponent(url.pathname.slice(1)) : process.env.DB_NAME;
  const user = url ? decodeURIComponent(url.username) : process.env.DB_USER;
  const password = url ? decodeURIComponent(url.password) : process.env.DB_PASSWORD;
  if (!name || !user) throw new Error("Set DB_NAME and DB_USER, or a complete DATABASE_URL");
  pool = mariadb.createPool({
    host: url?.hostname || process.env.DB_HOST || "127.0.0.1", port: Number(url?.port || process.env.DB_PORT || 3306),
    user, password,
    database: name, connectionLimit: databaseConnectionLimit(), minimumIdle: 0,
    connectTimeout: 10_000, acquireTimeout: 15_000, idleTimeout: 60,
    timezone: "+00:00", dateStrings: true, charset: "utf8mb4",
    ...(url?.searchParams.get("ssl") === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  shared.sisatMariaPool = pool;
  return pool;
}

export async function ensureMariaSchema(): Promise<void> {
  const conn = await database().getConnection();
  try {
    // Never install this app's schema into a WordPress or other application's database.
    const tables = await conn.query("SHOW TABLES") as Record<string, string>[];
    if (tables.some((row) => !Object.values(row)[0].startsWith("sisat_"))) {
      throw new Error("Use a NEW dedicated database; unrelated tables were found. Setup stopped.");
    }
    const statements = [
      `CREATE TABLE IF NOT EXISTS sisat_users (
        id varchar(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        username varchar(80) NOT NULL UNIQUE, display_name varchar(120) NOT NULL,
        phone varchar(30) NULL UNIQUE, position int NOT NULL, data JSON NOT NULL,
        INDEX sisat_users_name_search(display_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS sisat_products (id varchar(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, position int NOT NULL, data JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sisat_zones (id varchar(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, position int NOT NULL, data JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sisat_orders (
        id varchar(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        user_id varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        status varchar(40) NOT NULL, type varchar(20) NOT NULL, created_at datetime(3) NOT NULL,
        position int NOT NULL, data JSON NOT NULL,
        CONSTRAINT sisat_orders_user_fk FOREIGN KEY(user_id) REFERENCES sisat_users(id) ON DELETE RESTRICT,
        INDEX sisat_orders_customer_date(user_id,created_at),
        INDEX sisat_orders_status_date(status,created_at),
        INDEX sisat_orders_type_date(type,created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sisat_sessions (
        token varchar(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        user_id varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        expires_at datetime(3) NOT NULL, last_active_at datetime(3) NOT NULL,
        CONSTRAINT sisat_sessions_user_fk FOREIGN KEY(user_id) REFERENCES sisat_users(id) ON DELETE CASCADE,
        INDEX sisat_sessions_expiry(expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      "CREATE TABLE IF NOT EXISTS sisat_blocked_tables (id varchar(20) PRIMARY KEY) ENGINE=InnoDB",
      "CREATE TABLE IF NOT EXISTS sisat_audit (id bigint unsigned AUTO_INCREMENT PRIMARY KEY, data JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS sisat_settings (setting_key varchar(60) PRIMARY KEY, value JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      "CREATE TABLE IF NOT EXISTS sisat_write_lock (id tinyint PRIMARY KEY) ENGINE=InnoDB",
      "INSERT IGNORE INTO sisat_write_lock(id) VALUES(1)",
    ];
    for (const sql of statements) await conn.query(sql);
  } finally { conn.release(); }
}

const sqlDate = (value: string) => new Date(value).toISOString().slice(0, 23).replace("T", " ");
const isoDate = (value: string) => new Date(value.replace(" ", "T") + "Z").toISOString();

function json<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
async function readFrom(conn: PoolConnection): Promise<DemoData> {
  const users = await conn.query("SELECT data FROM sisat_users ORDER BY position,id");
  const products = await conn.query("SELECT data FROM sisat_products ORDER BY position,id");
  const zones = await conn.query("SELECT data FROM sisat_zones ORDER BY position,id");
  const orders = await conn.query("SELECT data FROM sisat_orders ORDER BY position,id");
  const sessions = await conn.query("SELECT token,user_id,expires_at,last_active_at FROM sisat_sessions");
  const blocked = await conn.query("SELECT id FROM sisat_blocked_tables ORDER BY id");
  const audit = await conn.query("SELECT data FROM sisat_audit ORDER BY id");
  const settings = await conn.query("SELECT setting_key,value FROM sisat_settings");
  const value = new Map<string, unknown>(settings.map((row: Record<string, unknown>) => [row.setting_key as string, json(row.value)]));
  return {
    users: users.map((r: {data: unknown}) => json<DemoUser>(r.data)),
    products: products.map((r: {data: unknown}) => json<Product>(r.data)),
    zones: zones.map((r: {data: unknown}) => json<Zone>(r.data)),
    orders: orders.map((r: {data: unknown}) => json<DemoOrder>(r.data)),
    sessions: sessions.map((r: {token: string; user_id: string; expires_at: string; last_active_at: string}) => ({
      token: r.token, userId: r.user_id, expiresAt: isoDate(r.expires_at), lastActiveAt: isoDate(r.last_active_at),
    })),
    blockedTables: blocked.map((r: {id: string}) => r.id),
    audit: audit.map((r: {data: unknown}) => json<AuditEntry>(r.data)),
    schemaVersion: Number(value.get("schemaVersion") ?? 0),
    categories: value.get("categories") as DemoData["categories"],
    settings: value.get("eventSettings") as DemoData["settings"],
    brandingHistory: value.get("brandingHistory") as DemoData["brandingHistory"],
  };
}

export async function readMariaData(): Promise<DemoData> {
  const conn = await database().getConnection();
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await conn.query("START TRANSACTION READ ONLY");
    const data = await readFrom(conn);
    await conn.commit();
    return data;
  } catch (error) { await conn.rollback().catch(() => undefined); throw error; }
  finally { conn.release(); }
}

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
async function persist(conn: PoolConnection, before: DemoData, after: DemoData): Promise<void> {
  const oldUsers = new Map(before.users.map((u) => [u.id, u]));
  for (const [position, user] of after.users.entries()) {
    if (!changed(oldUsers.get(user.id), user) && before.users.findIndex((u) => u.id === user.id) === position) continue;
    if (oldUsers.has(user.id)) {
      await conn.query("UPDATE sisat_users SET username=?,display_name=?,phone=?,position=?,data=? WHERE id=?",
        [user.username, user.displayName, user.phone || null, position, JSON.stringify(user), user.id]);
    } else {
      await conn.query("INSERT INTO sisat_users(id,username,display_name,phone,position,data) VALUES(?,?,?,?,?,?)",
        [user.id, user.username, user.displayName, user.phone || null, position, JSON.stringify(user)]);
    }
  }
  for (const table of ["products", "zones"] as const) {
    const old = new Map(before[table].map((r) => [r.id, r]));
    for (const [position, record] of after[table].entries()) {
      if (!changed(old.get(record.id), record) && before[table].findIndex((r) => r.id === record.id) === position) continue;
      await conn.query(`INSERT INTO sisat_${table}(id,position,data) VALUES(?,?,?)
        ON DUPLICATE KEY UPDATE position=VALUES(position),data=VALUES(data)`, [record.id, position, JSON.stringify(record)]);
    }
  }
  const oldOrders = new Map(before.orders.map((o) => [o.id, o]));
  for (const [position, order] of after.orders.entries()) {
    if (!changed(oldOrders.get(order.id), order) && before.orders.findIndex((o) => o.id === order.id) === position) continue;
    await conn.query(`INSERT INTO sisat_orders(id,user_id,status,type,created_at,position,data) VALUES(?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),status=VALUES(status),type=VALUES(type),
      created_at=VALUES(created_at),position=VALUES(position),data=VALUES(data)`,
      [order.id, order.userId, order.status, order.type, sqlDate(order.createdAt), position, JSON.stringify(order)]);
  }
  // Delete child orders first; customers with history remain protected by the FK and workflow.
  for (const table of ["orders", "products", "users", "zones"] as const) {
    const ids = new Set(after[table].map((r) => r.id));
    for (const old of before[table]) if (!ids.has(old.id)) await conn.query(`DELETE FROM sisat_${table} WHERE id=?`, [old.id]);
  }
  const oldSessions = new Map(before.sessions.map((s) => [s.token, s]));
  for (const session of after.sessions) {
    // Do not overwrite a heartbeat received concurrently for an otherwise unchanged session.
    if (!changed(oldSessions.get(session.token), session)) continue;
    await conn.query(`INSERT INTO sisat_sessions(token,user_id,expires_at,last_active_at) VALUES(?,?,?,?)
      ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at),last_active_at=VALUES(last_active_at)`,
      [session.token, session.userId, sqlDate(session.expiresAt), sqlDate(session.lastActiveAt ?? session.expiresAt)]);
  }
  const tokens = new Set(after.sessions.map((s) => s.token));
  for (const token of oldSessions.keys()) if (!tokens.has(token)) await conn.query("DELETE FROM sisat_sessions WHERE token=?", [token]);
  if (changed(before.blockedTables, after.blockedTables)) {
    await conn.query("DELETE FROM sisat_blocked_tables");
    for (const id of after.blockedTables) await conn.query("INSERT INTO sisat_blocked_tables(id) VALUES(?)", [id]);
  }
  if (changed(before.audit, after.audit)) {
    await conn.query("DELETE FROM sisat_audit");
    for (const entry of after.audit) await conn.query("INSERT INTO sisat_audit(data) VALUES(?)", [JSON.stringify(entry)]);
  }
  const settings = {
    schemaVersion: after.schemaVersion ?? 0, categories: after.categories ?? [],
    eventSettings: after.settings ?? {}, brandingHistory: after.brandingHistory ?? [],
  };
  const previous = {
    schemaVersion: before.schemaVersion ?? 0, categories: before.categories ?? [],
    eventSettings: before.settings ?? {}, brandingHistory: before.brandingHistory ?? [],
  };
  for (const key of Object.keys(settings) as (keyof typeof settings)[]) {
    if (!changed(previous[key], settings[key])) continue;
    await conn.query("INSERT INTO sisat_settings(setting_key,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [key, JSON.stringify(settings[key])]);
  }
}

export async function mutateMariaData<T>(fn: (data: DemoData) => Promise<T> | T): Promise<T> {
  const conn = await database().getConnection();
  try {
    await conn.beginTransaction();
    // InnoDB row lock is released automatically on COMMIT/ROLLBACK, including across Passenger workers.
    await conn.query("SELECT id FROM sisat_write_lock WHERE id=1 FOR UPDATE");
    const data = await readFrom(conn);
    const before = structuredClone(data);
    const result = await fn(data);
    await persist(conn, before, data);
    await conn.commit();
    return result;
  } catch (error) { await conn.rollback().catch(() => undefined); throw error; }
  finally { conn.release(); }
}

export async function importMariaData(source: DemoData): Promise<void> {
  await mutateMariaData((data) => {
    if (data.users.length || data.orders.length) throw new Error("Database is not empty; import stopped");
    Object.assign(data, source);
  });
}

export async function searchMariaCustomers(query: string, limit = 50, offset = 0) {
  const term = `%${query.trim().replaceAll("!", "!!").replaceAll("%", "!%").replaceAll("_", "!_")}%`;
  const rows = await database().query(`SELECT u.id,u.display_name,u.username,u.phone,count(o.id) AS order_count
    FROM sisat_users u LEFT JOIN sisat_orders o ON o.user_id=u.id
    WHERE JSON_UNQUOTE(JSON_EXTRACT(u.data,'$.role'))='customer'
      AND JSON_UNQUOTE(JSON_EXTRACT(u.data,'$.active'))='true'
      AND (?='' OR u.display_name LIKE ? ESCAPE '!' OR u.username LIKE ? ESCAPE '!'
        OR coalesce(u.phone,'') LIKE ? ESCAPE '!' OR CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ? ESCAPE '!')
    GROUP BY u.id,u.display_name,u.username,u.phone
    ORDER BY u.display_name,u.id LIMIT ? OFFSET ?`,
    [query.trim(), term, term, term, term, Math.min(Math.max(1, limit), 100), Math.max(0, offset)]);
  return rows.map((r: {id: string; display_name: string; username: string; phone: string | null; order_count: bigint}) => ({
    id: r.id, displayName: r.display_name, username: r.username, phone: r.phone ?? undefined, orderCount: Number(r.order_count),
  }));
}

export async function touchMariaSession(token: string): Promise<boolean> {
  const result = await database().query(`UPDATE sisat_sessions s JOIN sisat_users u ON u.id=s.user_id
    SET s.last_active_at=UTC_TIMESTAMP(3)
    WHERE s.token=? AND JSON_UNQUOTE(JSON_EXTRACT(u.data,'$.active'))='true'
      AND s.expires_at>UTC_TIMESTAMP(3)
      AND s.last_active_at>TIMESTAMPADD(SECOND,
        -COALESCE((SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.idleSeconds')) AS SIGNED)
          FROM sisat_settings WHERE setting_key='eventSettings'),300),UTC_TIMESTAMP(3))`, [token]);
  return result.affectedRows === 1;
}
export async function closeMaria(): Promise<void> {
  if (shared.sisatMariaPool) { await shared.sisatMariaPool.end(); shared.sisatMariaPool = undefined; pool = undefined; }
}
