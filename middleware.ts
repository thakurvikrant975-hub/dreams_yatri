import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";

export const runtime = "nodejs";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const isLoginPage = pathname === "/dashboard/login";

    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName: "dy.dashboard.session-token",
    });

    if (isLoginPage && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (!isLoginPage && !token) {
      return NextResponse.redirect(new URL("/dashboard/login", req.url));
    }

    // Forward the requested path so the layout can enforce per-role page access
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/hotel-connect")) {
    // Redirect away to the dashboard if already logged in.
    const isAuthPage =
      pathname === "/hotel-connect/login" ||
      pathname === "/hotel-connect/signup";

    // Token-gated (not session-gated) pages — accessible whether or not the
    // visitor happens to have an active session, since they're reached via a
    // one-time emailed link, not by being logged in.
    const isTokenPage =
      pathname === "/hotel-connect/forgot-password" ||
      pathname === "/hotel-connect/reset-password" ||
      pathname === "/hotel-connect/verify-email";

    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName: "dy.hotel-connect.session-token",
    });

    if (isAuthPage && token) {
      return NextResponse.redirect(new URL("/hotel-connect", req.url));
    }

    if (!isAuthPage && !isTokenPage && !token) {
      return NextResponse.redirect(new URL("/hotel-connect/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js)).*)",],
};