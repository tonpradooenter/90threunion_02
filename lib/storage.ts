import path from "node:path";

/** Runtime data must survive app updates and stay outside the public document root. */
export function storagePath(...parts: string[]): string {
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || path.join(process.cwd(), "data"));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(publicRoot + path.sep)) {
    throw new Error("STORAGE_DIR must be outside the public document root");
  }
  return path.join(/*turbopackIgnore: true*/ root, ...parts);
}
