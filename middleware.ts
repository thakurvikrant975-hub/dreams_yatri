// middleware.ts
import { auth } from "@/auth";

export const runtime = "nodejs";

export default auth((req) => {
  const role   = req.auth?.user?.role;
  const status = req.auth?.user?.status;

  const { pathname } = req.nextUrl;

  // Block banned/deleted users
  if (status === "BANNED" || status === "DELETED") {
    return Response.redirect(new URL("/login", req.url));
  }

  // Admin route protection
  if (pathname.startsWith("/dashboard/admin") && role !== "ADMIN") {
    return Response.redirect(new URL("/unauthorized", req.url));
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};