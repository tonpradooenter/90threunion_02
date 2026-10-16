import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { storagePath } from "./storage";
import type { DemoData } from "./demo-types";

const magic = Buffer.from("SISAT-SLIP-1\0");
const keyPromises = new Map<string, Promise<Buffer>>();
export function encryptedSlip(bytes: Uint8Array): boolean {
  return bytes.length >= magic.length && Buffer.from(bytes.subarray(0, magic.length)).equals(magic);
}
async function key(): Promise<Buffer> {
  if (process.env.SLIP_ENCRYPTION_KEY) {
    if (!/^[0-9a-f]{64}$/i.test(process.env.SLIP_ENCRYPTION_KEY)) throw new Error("Invalid SLIP_ENCRYPTION_KEY; use 64 hexadecimal characters");
    return Buffer.from(process.env.SLIP_ENCRYPTION_KEY, "hex");
  }
  const filename = storagePath(".security", "slip-v1.key");
  if (!keyPromises.has(filename)) keyPromises.set(filename, (async () => {
    await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    // wx makes first-time key creation safe across Passenger workers. Never overwrite an existing key.
    try { await fs.writeFile(filename, randomBytes(32), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    for (let attempt = 0; attempt < 10; attempt++) {
      const saved = await fs.readFile(filename);
      if (saved.length === 32) return saved;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Slip encryption key is incomplete; restore the saved key");
  })().catch((error) => { keyPromises.delete(filename); throw error; }));
  return keyPromises.get(filename)!;
}
export async function encryptSlip(bytes: Uint8Array): Promise<Buffer> {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await key(), nonce);
  cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([magic, nonce, cipher.getAuthTag(), ciphertext]);
}
export async function decryptSlip(bytes: Uint8Array): Promise<Buffer> {
  const saved = Buffer.from(bytes);
  if (!encryptedSlip(saved)) {
    // Only known legacy image signatures are accepted; a damaged encryption header must not bypass validation.
    const png = saved.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = saved[0] === 255 && saved[1] === 216 && saved[2] === 255;
    const webp = saved.subarray(0,4).toString() === "RIFF" && saved.subarray(8,12).toString() === "WEBP";
    if (!png && !jpg && !webp) throw new Error("Invalid legacy slip image or damaged encryption header");
    return saved;
  }
  if (saved.length < magic.length + 28) throw new Error("Invalid encrypted slip");
  const offset = magic.length;
  const decipher = createDecipheriv("aes-256-gcm", await key(), saved.subarray(offset, offset + 12));
  decipher.setAAD(magic);
  decipher.setAuthTag(saved.subarray(offset + 12, offset + 28));
  return Buffer.concat([decipher.update(saved.subarray(offset + 28)), decipher.final()]);
}
export async function encryptExistingSlips(data: DemoData): Promise<number> {
  let count = 0;
  const filenames = new Set(data.orders.flatMap((order) => [
    ...(order.slips ?? []).map((slip) => slip.filename), ...(order.slipFile ? [order.slipFile] : []),
  ]));
  for (const name of filenames) {
    if (!/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(name)) throw new Error("Unexpected slip filename; migration stopped");
    const file = storagePath("slips", name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Unsafe slip file; migration stopped");
    const bytes = await fs.readFile(file);
    if (encryptedSlip(bytes)) { await decryptSlip(bytes); continue; }
    const temp = file + "." + randomBytes(6).toString("hex") + ".tmp";
    try {
      await fs.writeFile(temp, await encryptSlip(bytes), { flag: "wx", mode: 0o600 });
      await fs.rename(temp, file);
      count++;
    } finally { await fs.unlink(temp).catch(() => undefined); }
  }
  return count;
}
