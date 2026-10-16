import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const keys = ["DB_PASSWORD", "DEMO_PASSWORD", "SLIP_ENCRYPTION_KEY"];
const secrets = keys.map((key) => process.env[key]).filter((value) => value && value.length >= 12);
let files = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(filename);
    else if (/\.(js|css|map)$/.test(entry.name)) {
      if (/\.js\.map$/.test(entry.name)) throw new Error("Production browser source map found");
      const text = await readFile(filename, "utf8");
      if (secrets.some((value) => text.includes(value))) throw new Error("Server-only secret reached a browser asset; release stopped");
      files++;
    }
  }
}
await scan(".next/static");
console.log(`Browser asset security check passed: ${files} files, ${secrets.length} server-only secret probes.`);
