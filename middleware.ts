// middleware.ts
import { auth } from "@/app/lib/auth";
import { dashboardAuth } from "./app/lib/auth-dashboard";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";

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

// ── Request context injector ──────────────────────────────────────────────────
// Stamps every passing request with trace headers.
// createLog() in server actions reads these automatically via next/headers.
// We never write to DB here — middleware runs before every request,
// DB calls here would add latency to every page load.
function withRequestContext(response: NextResponse, req: NextRequest): NextResponse {
  response.headers.set("x-request-id", crypto.randomUUID());
  response.headers.set("x-request-path", req.nextUrl.pathname);
  response.headers.set("x-request-method", req.method);
  response.headers.set(
    "x-real-ip",
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
  return response;
}

// ── Main middleware ───────────────────────────────────────────────────────────
export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // ════════════════════════════════════════════════════════════════════════════
  // BRANCH 1: Employee dashboard routes (/dashboard/*)
  // Uses a separate session cookie (dy.dashboard.session-token),
  // completely isolated from public user auth.
  // ════════════════════════════════════════════════════════════════════════════
  if (pathname.startsWith("/dashboard")) {
    const isLoginPage       = pathname === "/dashboard/login";
    const employeeSession   = await dashboardAuth();
    const isEmployeeLoggedIn = !!employeeSession;

    // Authenticated employee hitting login page → send to dashboard home
    if (isLoginPage && isEmployeeLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Unauthenticated employee hitting any dashboard route → force login
    if (!isLoginPage && !isEmployeeLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard/login", req.url));
    }

    // RBAC — check route-level permissions
    if (isEmployeeLoggedIn && !isLoginPage) {
      const permissions = employeeSession.user.permissions ?? [];

      const requiredPermission = Object.entries(DASHBOARD_ROUTE_PERMISSIONS).find(
        ([route]) => pathname.startsWith(route)
      )?.[1];

      // Uncomment when permission system is fully wired up
      // if (requiredPermission && !permissions.includes(requiredPermission)) {
      //   return NextResponse.redirect(new URL("/dashboard/unauthorized", req.url));
      // }
    }

    // ✅ Inject trace headers — consumed by createLog() in server actions
    return withRequestContext(NextResponse.next(), req);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BRANCH 2: Public website routes
  // Uses NextAuth v5 session via req.auth
  // ════════════════════════════════════════════════════════════════════════════
  const user              = req.auth?.user;
  const isLoggedIn        = !!user;
  const role              = user?.role;
  const status            = user?.status;
  const isProfileComplete = user?.isProfileComplete;

  const isProtectedRoute  = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAdminRoute      = ADMIN_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute       = AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isOnboarding      = pathname.startsWith("/onboarding");

  // 1. Block banned or deleted accounts immediately
  if (isLoggedIn && (status === "BANNED" || status === "DELETED")) {
    return NextResponse.redirect(new URL("/banned", req.url));
  }

  // 2. Logged-in user hitting an auth-only page (e.g. /auth/verify) → dashboard
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 3. Guest hitting a protected route → back to home with login modal trigger
  if (!isLoggedIn && isProtectedRoute) {
    const url = new URL("/", req.url);
    url.searchParams.set("auth", "login");
    return NextResponse.redirect(url);
  }

  // 4. Guest hitting onboarding → home
  if (!isLoggedIn && isOnboarding) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 5. Profile already complete trying to access onboarding → dashboard
  if (isLoggedIn && isProfileComplete && isOnboarding) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 6. Incomplete profile hitting protected routes → onboarding (disabled for now)
  // if (isLoggedIn && !isProfileComplete && isProtectedRoute) {
  //   return NextResponse.redirect(new URL("/onboarding", req.url));
  // }

  // 7. Non-admin hitting admin routes → unauthorized
  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // ✅ Inject trace headers for all passing public requests
  return withRequestContext(NextResponse.next(), req);
});

// ── Matcher ───────────────────────────────────────────────────────────────────
// Excludes static files, images, and API routes from middleware execution.
// Middleware only runs on actual page navigations and server action calls.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js)).*)",
  ],
};