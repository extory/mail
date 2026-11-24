// Resend previously used the application hostname as its tracking domain.
// Keep links already delivered to recipients working without changing DNS.
export function GET(request: Request) {
  const pathname = new URL(request.url).pathname;
  const match = /^\/CL0\/([^/]+)\/\d+\/[^/]+\/[^/]+$/.exec(pathname);
  if (match) {
    try {
      const destination = new URL(decodeURIComponent(match[1]));
      // Only restore the intended HR destination, never arbitrary external URLs.
      if (destination.origin === "https://hr.aline.team" && !destination.username && !destination.password) {
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
