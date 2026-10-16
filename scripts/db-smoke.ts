import { spawnSync } from "node:child_process";
import { databaseProvider } from "../lib/database-config";
const script = databaseProvider() === "mariadb"
  ? ["--test", "tests/mariadb.integration.ts"] : ["scripts/db-smoke-postgres.ts"];
const result = spawnSync(process.execPath, ["--import", "tsx", ...script], { env: process.env, stdio: "inherit" });
process.exitCode = result.status ?? 1;
