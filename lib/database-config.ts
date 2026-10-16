export type DatabaseProvider = "postgres" | "mariadb" | "file";

export function databaseProvider(): DatabaseProvider {
  const value = process.env.DATABASE_URL;
  if (!value) {
    if (process.env.DB_DRIVER === "mariadb" || process.env.DB_NAME || process.env.DB_USER) {
      if (process.env.DB_DRIVER !== "mariadb" || !process.env.DB_NAME || !process.env.DB_USER) throw new Error("Set DB_DRIVER=mariadb, DB_NAME and DB_USER");
      return "mariadb";
    }
    if (process.env.NODE_ENV === "production") throw new Error("Database configuration is required: set DB_DRIVER=mariadb, DB_NAME, DB_USER and DB_PASSWORD, or DATABASE_URL. For Plesk commands, configure .env.local in Application Root.");
    return "file";
  }
  let protocol: string;
  try { protocol = new URL(value).protocol; }
  catch { throw new Error("DATABASE_URL is invalid"); }
  if (["postgres:", "postgresql:"].includes(protocol)) return "postgres";
  if (["mysql:", "mariadb:"].includes(protocol)) return "mariadb";
  throw new Error("DATABASE_URL must use mariadb://, mysql:// or postgresql://");
}

export function databaseConnectionLimit(): number {
  const value = Number(process.env.DATABASE_CONNECTION_LIMIT || 5);
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error("DATABASE_CONNECTION_LIMIT must be 1–20");
  return value;
}
