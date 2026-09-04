import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/app/lib/db";

const DASHBOARD_SESSION_COOKIE = "dy.dashboard.session-token";

function clearDashboardSession(url: string, req: NextRequest) {
  const res = NextResponse.redirect(new URL(url, req.url));
  // The cookie is set with path: "/dashboard" (auth-dashboard.ts) — a browser
  // treats cookies with different Path attributes as distinct, so deleting
  // without matching that path creates a separate, ineffective cookie and
  // leaves the original (still "valid") one being resent forever, which
  // just loops this same redirect instead of ever actually logging out.
  res.cookies.delete({ name: DASHBOARD_SESSION_COOKIE, path: "/dashboard" });
  return res;
}

// Renamed from `middleware.ts` (Next 16 deprecated that convention). Note there
// is deliberately no `export const runtime` here: Proxy runs on the Node.js
// runtime by default, and setting the option throws — which is what `getToken`
// needs anyway.
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const isLoginPage = pathname === "/dashboard/login";

    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName: "dy.dashboard.session-token",
    });

    if (token) {
      // Force-logout / deactivate check — dashboard sessions are stateless
      // JWTs (see auth-dashboard.ts), so there's no server-side session row
      // to delete; this compares the version number embedded in the token
      // at sign-in against the live value on the TeamMember row (bumped by
      // team-members/actions.ts's forceLogoutMember, or by deactivating).
      // Runs here (not in the jwt callback) specifically so the response
      // can actually clear the cookie — a Server Component render can't,
      // which would otherwise leave a "valid-looking" cookie that keeps
      // bouncing the login page back to /dashboard forever.
      try {
        const fresh = await db.teamMember.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, sessionVersion: true },
        });
        if (!fresh || !fresh.isActive || fresh.sessionVersion !== (token.sessionVersion ?? 0)) {
          return clearDashboardSession("/dashboard/login", req);
        }
      } catch (e) {
        // Fail open — a transient DB hiccup must never log out the whole
        // team; worst case a force-logout/deactivation takes effect a
        // request later than intended.
        console.error("[proxy] dashboard session freshness check failed:", e);
      }
    }

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

  if (pathname.startsWith("/partner")) {
    // The partner portal. Its cookie is Path-scoped to /partner, so a partner
    // session is not merely unprivileged elsewhere on the site — it is never
    // sent there at all, and a dashboard session is never sent here.
    const isAuthPage = pathname === "/partner/login";

    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName: "dy.partner.session-token",
    });

    if (isAuthPage && token) {
      return NextResponse.redirect(new URL("/partner/leads", req.url));
    }
    if (!isAuthPage && !token) {
      return NextResponse.redirect(new URL("/partner/login", req.url));
    }
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
      pathname === "/hotel-connect/verify-email" ||
      // Ably token endpoint lives under /hotel-connect so the owner's
      // Path-scoped session cookie reaches it, but a GUEST calling it (from
      // a normal site page, no hotel-connect session at all) must not be
      // bounced to the hotel-connect login screen — it does its own
      // authorization (authorizeConversationAccess) for both sides.
      pathname === "/hotel-connect/api/ably/token";

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