import { createHash } from "node:crypto";

const counters = new Map<string, { count: number; until: number }>();
/** Per-worker backstop. Plesk/WAF should also limit requests before they reach Node. */
export function loginAllowed(username: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const identity = createHash("sha256").update(username.toLowerCase()).digest("hex");
  let entry = counters.get(identity);
  if (!entry || entry.until <= now) {
    if (counters.size >= 10000) {
      for (const [key, value] of counters) if (value.until <= now) counters.delete(key);
      if (counters.size >= 10000) counters.delete(counters.keys().next().value!);
    }
    entry = { count: 0, until: now + 60_000 };
    counters.set(identity, entry);
  }
  entry.count++;
  return { allowed: entry.count <= 12, retryAfter: Math.max(1, Math.ceil((entry.until - now) / 1000)) };
}
