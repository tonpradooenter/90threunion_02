/** Accept the same site, including the two equivalent loopback names used by local demos. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    if (source.origin === target.origin) return true;
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return source.protocol === target.protocol
      && source.port === target.port
      && loopback.has(source.hostname)
      && loopback.has(target.hostname);
  } catch { return false; }
}
