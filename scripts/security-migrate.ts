import { closeDatabase } from "../lib/database-store";
import { readData } from "../lib/demo-store";
import { encryptExistingSlips } from "../lib/private-slips";
async function main() {
  const count = await encryptExistingSlips(await readData());
  console.log(`Slip security migration complete: ${count} legacy files encrypted. Existing encrypted files verified.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; }).finally(closeDatabase);
