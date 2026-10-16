/** Pin the public origin explicitly; do not trust arbitrary forwarded headers. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const source = new URL(origin);
    if (process.env.APP_ORIGIN) return source.origin === new URL(process.env.APP_ORIGIN).origin;
    const target = new URL(request.url);
    if (source.origin === target.origin) return true;
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return source.protocol === target.protocol && source.port === target.port
      && loopback.has(source.hostname) && loopback.has(target.hostname);
  } catch { return false; }
}
