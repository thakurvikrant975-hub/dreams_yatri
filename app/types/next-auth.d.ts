import "next-auth";
import "next-auth/jwt";
import { Role, UserStatus } from "@/app/generated/prisma";
import { Prisma } from "@/app/generated/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id:                 string;
      name?:              string | null;
      email?:             string | null;
      image?:             string | null;

      // ── Public user auth (main website) ──
      phone?:             string | null;
      role?:              Role | null;
      status?:            UserStatus | null;
      isProfileComplete?: boolean;

      // ── Dashboard employee auth ──
      dashboardRole?:     string | null;      // team role name (string)
      permissions?:       Prisma.JsonValue;
      pageAccess?:        string[] | null;
      departmentId?:      string | null;
    };
  }

  interface User {
    // ── Public user auth ──
    phone?:             string | null;
    role?:              Role | null;
    status?:            UserStatus | null;
    isProfileComplete?: boolean;

    // ── Dashboard employee auth ──
    dashboardRole?:     string | null;
    permissions?:       Prisma.JsonValue;
    pageAccess?:        string[] | null;
    departmentId?:      string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    // ── Public user auth ──
    userId?:            string;
    phone?:             string | null;
    role?:              Role | null;
    status?:            UserStatus | null;
    isProfileComplete?: boolean;
    picture?:           string | null;

    // ── Dashboard employee auth ──
    dashboardRole?:     string | null;
    permissions?:       Prisma.JsonValue;
    pageAccess?:        string[] | null;
    departmentId?:      string | null;
    /** TeamMember.sessionVersion at sign-in — compared against the live DB
     * value in proxy.ts on every /dashboard request to force-invalidate a
     * token (see forceLogoutMember). */
    sessionVersion?:    number;
  }
}