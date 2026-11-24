// Resend previously used the application hostname as its tracking domain.
// Keep links already delivered to recipients working without changing DNS.
// Audited against all 70 send_log HTML snapshots on 2026-11-24.
const historicalOrigins = new Set([
  "https://hr.aline.team",
  "https://aline.team",
  "https://alineteam.kr",
  "https://showcase.aline.team",
  "https://extory.co",
]);

export function GET(request: Request) {
  const pathname = new URL(request.url).pathname;
  const match = /^\/CL0\/([^/]+)\/\d+\/[^/]+\/[^/]+$/.exec(pathname);
  if (match) {
    try {
      const destination = new URL(decodeURIComponent(match[1]));
      // Unsubscribe links are appended per recipient, outside stored campaign HTML.
      // Only allow the confirmation routes, not arbitrary app paths or nested CL0 links.
      const unsubscribe = destination.origin === "https://mail.extory.co" &&
        ["/unsubscribe", "/api/unsubscribe"].includes(destination.pathname);
      if ((historicalOrigins.has(destination.origin) || unsubscribe) && !destination.username && !destination.password) {
        return new Response(null, {
          status: 307,
          headers: {
            Location: destination.href,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      }
    } catch {
      // Malformed or unsupported tracking links must not become open redirects.
    }
  }
  return new Response("Not found", { status: 404 });
}
