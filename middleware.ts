// middleware.ts
import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PROTECTED_ROUTES  = ["/dashboard", "/profile", "/bookings"]; // ← removed /onboarding
const ADMIN_ROUTES      = ["/dashboard/admin"];
const AUTH_ROUTES       = ["/auth/verify"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user         = req.auth?.user;

  const isLoggedIn        = !!user;
  const role              = user?.role;
  const status            = user?.status;
  const isProfileComplete = user?.isProfileComplete;

  const isProtectedRoute  = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAdminRoute      = ADMIN_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute       = AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isOnboarding      = pathname.startsWith("/onboarding");

  // ── 1. Block banned/deleted ───────────────────────────────────────────────────
  if (isLoggedIn && (status === "BANNED" || status === "DELETED")) {
    return NextResponse.redirect(new URL("/banned", req.url));
  }

  // ── 2. Logged-in hitting auth-only pages ──────────────────────────────────────
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── 3. Guest hitting protected route ──────────────────────────────────────────
  if (!isLoggedIn && isProtectedRoute) {
    const url = new URL("/", req.url);
    url.searchParams.set("auth", "login");
    return NextResponse.redirect(url);
  }

  // ── 4. Guest hitting onboarding → home ───────────────────────────────────────
  if (!isLoggedIn && isOnboarding) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ── 5. Complete profile trying to access onboarding → dashboard ───────────────
  if (isLoggedIn && isProfileComplete && isOnboarding) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── 6. Incomplete profile hitting protected routes → onboarding ───────────────
  // if (isLoggedIn && !isProfileComplete && isProtectedRoute) {
  //   return NextResponse.redirect(new URL("/onboarding", req.url));
  // }

  // ── 7. Admin route protection ─────────────────────────────────────────────────
  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js)).*)",
  ],
};