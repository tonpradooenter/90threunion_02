import mariadb from "mariadb";
import { readFile } from "node:fs/promises";
const { rootPassword } = JSON.parse(await readFile("tmp/mariadb-local-secret.json", "utf8"));
const conn = await mariadb.createConnection({ host: "127.0.0.1", port: 33079, user: "root", password: rootPassword });
try { await conn.query("SHUTDOWN"); } finally { await conn.end().catch(() => {}); }
