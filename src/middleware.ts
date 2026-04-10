import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-only-insecure-jwt-secret"
);

const protectedPaths = [
  "/dashboard",
  "/subscribers",
  "/groups",
  "/drafts",
  "/compose",
  "/history",
  "/invitations",
  "/statistics",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF: Block cross-origin state-changing requests to API
  if (pathname.startsWith("/api/") && request.method !== "GET") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isProtectedApi = pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/unsubscribe") &&
    !pathname.startsWith("/api/webhooks/");

  if (!isProtected && !isProtectedApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get("mail_session")?.value;
  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/subscribers/:path*",
    "/groups/:path*",
    "/drafts/:path*",
    "/compose/:path*",
    "/history/:path*",
    "/invitations/:path*",
    "/statistics/:path*",
    "/settings/:path*",
    "/api/((?!auth/).*)",
  ],
};
