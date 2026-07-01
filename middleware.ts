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
    const isAuthPage =
      pathname === "/hotel-connect/login" ||
      pathname === "/hotel-connect/signup";

    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName: "dy.hotel-connect.session-token",
    });

    if (isAuthPage && token) {
      return NextResponse.redirect(new URL("/hotel-connect", req.url));
    }

    if (!isAuthPage && !token) {
      return NextResponse.redirect(new URL("/hotel-connect/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js)).*)",],
};