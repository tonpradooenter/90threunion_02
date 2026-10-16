import mariadb from "mariadb";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootFile = path.join(process.cwd(), "tmp", "mariadb-local-secret.json");
let rootPassword;
try { rootPassword = JSON.parse(await readFile(rootFile, "utf8")).rootPassword; } catch { /* first setup */ }
const connection = await mariadb.createConnection({ host: "127.0.0.1", port: 33079, user: "root", password: rootPassword || "", timezone: "+00:00" });
try {
  if (!rootPassword) {
    rootPassword = randomBytes(24).toString("hex");
    await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [rootPassword]);
    await writeFile(rootFile, JSON.stringify({ rootPassword }), { mode: 0o600 });
  }
  const appPassword = randomBytes(24).toString("hex");
  await connection.query("CREATE DATABASE IF NOT EXISTS sisat90_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await connection.query("CREATE DATABASE IF NOT EXISTS sisat_test_v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await connection.query("CREATE USER IF NOT EXISTS 'sisat90_app'@'localhost' IDENTIFIED BY ?", [appPassword]);
  await connection.query("ALTER USER 'sisat90_app'@'localhost' IDENTIFIED BY ?", [appPassword]);
  await connection.query("GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON sisat90_demo.* TO 'sisat90_app'@'localhost'");
  await connection.query("GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON sisat_test_v1.* TO 'sisat90_app'@'localhost'");
  const url = `mariadb://sisat90_app:${appPassword}@127.0.0.1:33079/`;
  const env = `DATABASE_URL=${url}sisat90_demo\nTEST_DATABASE_URL=${url}sisat_test_v1\nDATABASE_CONNECTION_LIMIT=5\nSTORAGE_DIR=./data/mariadb-v1\nAPP_ORIGIN=http://127.0.0.1:3000\nDEMO_PASSWORD=Demo@1234\n`;
  await writeFile(".env.mariadb.local", env, { mode: 0o600 });
  console.log("Local MariaDB accounts ready. Secrets are stored only in ignored local files.");
} finally { await connection.end(); }
