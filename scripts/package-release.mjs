import { spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const run = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "git command failed");
  return result.stdout.trim();
};
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const committed = JSON.parse(run("show", "HEAD:package.json"));
if (pkg.version !== committed.version) throw new Error("Commit the release version before packaging.");
if (run("status", "--porcelain", "--untracked-files=no")) throw new Error("Commit tracked changes before packaging.");
const paths = run("ls-files").split("\n");
const forbidden = paths.filter((name) => /^(?:\.env(?!\.example$)|data\/|tmp\/|node_modules\/|releases\/|diagnostics-|\.aws\/)|\.(?:pem|key|pfx)$/.test(name));
if (forbidden.length) throw new Error("Sensitive/runtime files would enter the release: " + forbidden.join(", "));
await mkdir("releases", { recursive: true });
const output = path.join("releases", `sisat90-v${pkg.version}-hostatom-source.zip`);
run("archive", "--format=zip", `--output=${output}`, "HEAD");
const hash = createHash("sha256").update(await readFile(output)).digest("hex");
await writeFile(output + ".sha256", hash + "  " + path.basename(output) + "\n");
console.log(output + "\nSHA256 " + hash + "\nSource only: install Linux dependencies and build on Plesk.");
