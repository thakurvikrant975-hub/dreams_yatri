// middleware.ts
import { auth } from "@/app/lib/auth";
import { dashboardAuth } from "./app/lib/auth-dashboard";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

// ── Public user auth ──────────────────────────────────────────────────────────
const PROTECTED_ROUTES = ["/profile", "/bookings"];
const ADMIN_ROUTES     = ["/admin"];
const AUTH_ROUTES      = ["/auth/verify"];

// ── Employee dashboard RBAC ───────────────────────────────────────────────────
const DASHBOARD_ROUTE_PERMISSIONS: Record<string, string> = {
  "/dashboard/team":     "team:read",
  "/dashboard/billing":  "billing:read",
  "/dashboard/packages": "packages:read",
};

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // ── BRANCH 1: Employee dashboard routes ──────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const isLoginPage = pathname === "/dashboard/login";

    // Employee session — reads dy.dashboard.session-token cookie
    const employeeSession = await dashboardAuth();
    const isEmployeeLoggedIn = !!employeeSession;

    // Authenticated employee hitting login → redirect to dashboard home
    if (isLoginPage && isEmployeeLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Unauthenticated hitting any dashboard route → login
    if (!isLoginPage && !isEmployeeLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard/login", req.url));
    }

    // RBAC — permission check per route
    if (isEmployeeLoggedIn && !isLoginPage) {
      const permissions = employeeSession.user.permissions ?? [];
      const requiredPermission = Object.entries(DASHBOARD_ROUTE_PERMISSIONS).find(
        ([route]) => pathname.startsWith(route)
      )?.[1];

      // if (requiredPermission && !permissions.includes(requiredPermission)) {
      //   return NextResponse.redirect(new URL("/dashboard/unauthorized", req.url));
      // }
    }

    return NextResponse.next();
  }

  // ── BRANCH 2: Public user routes (existing logic — untouched) ────────────────
  const user              = req.auth?.user;
  const isLoggedIn        = !!user;
  const role              = user?.role;
  const status            = user?.status;
  const isProfileComplete = user?.isProfileComplete;

  const isProtectedRoute = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAdminRoute     = ADMIN_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute      = AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isOnboarding     = pathname.startsWith("/onboarding");

  // 1. Block banned/deleted
  if (isLoggedIn && (status === "BANNED" || status === "DELETED")) {
    return NextResponse.redirect(new URL("/banned", req.url));
  }

  // 2. Logged-in hitting auth-only pages
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 3. Guest hitting protected route
  if (!isLoggedIn && isProtectedRoute) {
    const url = new URL("/", req.url);
    url.searchParams.set("auth", "login");
    return NextResponse.redirect(url);
  }

  // 4. Guest hitting onboarding → home
  if (!isLoggedIn && isOnboarding) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 5. Complete profile trying to access onboarding → dashboard
  if (isLoggedIn && isProfileComplete && isOnboarding) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 6. Incomplete profile hitting protected routes → onboarding (currently disabled)
  // if (isLoggedIn && !isProfileComplete && isProtectedRoute) {
  //   return NextResponse.redirect(new URL("/onboarding", req.url));
  // }

  // 7. Admin route protection
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