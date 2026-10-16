/* Plesk/Passenger startup file. Build with npm run build first. */
process.env.NODE_ENV ||= "production";
require("@next/env").loadEnvConfig(__dirname, false);

const path = require("node:path");
const { existsSync } = require("node:fs");
const { createServer } = require("node:http");

function validate() {
  if (!existsSync(path.join(__dirname, ".next", "BUILD_ID"))) throw new Error("Run npm run build before starting the app.");
  if (!process.env.DATABASE_URL && !(process.env.DB_DRIVER === "mariadb" && process.env.DB_NAME && process.env.DB_USER)) {
    throw new Error("Set DB_DRIVER=mariadb, DB_NAME, DB_USER and DB_PASSWORD in Plesk.");
  }
  if (!process.env.APP_ORIGIN) throw new Error("Set APP_ORIGIN to the HTTPS subdomain URL.");
  const origin = new URL(process.env.APP_ORIGIN);
  if (origin.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
    throw new Error("Public APP_ORIGIN must use HTTPS.");
  }
  process.chdir(__dirname);
}

async function main() {
  validate();
  const passenger = global.PhusionPassenger;
  if (passenger) passenger.configure({ autoInstall: false });
  const app = require("next")({ dev: false, dir: __dirname });
  const handler = app.getRequestHandler();
  await app.prepare();
  const server = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end("Application error");
    });
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 65_000;
  if (passenger) server.listen("passenger");
  else server.listen(Number(process.env.PORT || 3000), process.env.BIND_HOST || "127.0.0.1", () => {
    console.log("SISAT 90 v1 ready");
  });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
