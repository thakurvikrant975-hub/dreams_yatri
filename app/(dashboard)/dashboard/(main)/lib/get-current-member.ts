// app/(dashboard)/dashboard/(main)/lib/get-current-member.ts
import "server-only";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma";
import type { Session } from "next-auth";

const MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  joiningDate: true,
  lastLoginAt: true,
  profilePicKey: true,
  profilePicUrl: true,
  department: {
    select: { id: true, name: true },
  },
  teamRole: {
    select: { id: true, name: true, permissions: true, pageAccess: true },
  },
} as const;

type MemberResult = Prisma.TeamMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

/** Always returns the real logged-in member. Used by the layout for nav/auth. */
export async function getCurrentMember(session?: Session | null) {
  const resolvedSession = session ?? await dashboardAuth();
  if (!resolvedSession?.user?.email) return null;

  return db.teamMember.findUnique({
    where: { email: resolvedSession.user.email },
    select: MEMBER_SELECT,
  });
}

export type MemberContext = {
  /** The currently logged-in member (always the real account). */
  realMember: MemberResult;
  /** Effective member — impersonated target for FSD "View As", otherwise same as realMember. */
  member: MemberResult;
  /** True when an FSD is viewing as another member. */
  isImpersonating: boolean;
};

/**
 * Returns both the real member and the effective (possibly impersonated) member
 * in a single call. Use this in the layout AND in page.tsx so the sidebar/
 * page-access reflects the viewed member while the header stays the real user.
 */
export async function getEffectiveMember(session?: Session | null): Promise<MemberContext | null> {
  const resolvedSession = session ?? await dashboardAuth();
  if (!resolvedSession?.user?.email) return null;

  const realMember = await db.teamMember.findUnique({
    where: { email: resolvedSession.user.email },
    select: MEMBER_SELECT,
  });
  if (!realMember) return null;

  if (realMember.teamRole?.name?.toLowerCase() === "full stack developer") {
    const { cookies } = await import("next/headers");
    const viewAsId = (await cookies()).get("dy_view_as")?.value;
    if (viewAsId) {
      const impersonated = await db.teamMember.findUnique({
        where: { id: viewAsId },
        select: MEMBER_SELECT,
      });
      if (impersonated) {
        return { realMember, member: impersonated, isImpersonating: true };
      }
    }
  }

  return { realMember, member: realMember, isImpersonating: false };
}
