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
  joiningDateUnknown: true,
  lastLoginAt: true,
  profilePicKey: true,
  profilePicUrl: true,
  // The onboarding popup's required fields — selected here (not a separate
  // query) so the layout can decide whether to show it in the same fetch it
  // already runs for nav/header on every dashboard page.
  gender: true,
  personalEmail: true,
  personalMobile: true,
  alternativeMobile: true,
  department: {
    select: { id: true, name: true },
  },
  teamRole: {
    select: { id: true, name: true, permissions: true, pageAccess: true },
  },
} as const;

type MemberResult = Prisma.TeamMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

// Team members granted "View As" without holding the Full Stack Developer
// role — kept as its own allowlist (rather than folded into the FSD role
// check) so granting it never also grants the FSD page-access bypass in the
// dashboard layout, which is a much broader privilege than View As alone.
const VIEW_AS_EMAIL_ALLOWLIST = new Set(["karan@dreamsyatri.com"]);

/** Who may use "View As" — every Full Stack Developer, anyone in
 * VIEW_AS_EMAIL_ALLOWLIST regardless of role, every Sales Manager (full
 * roster — see getViewAsScope), and every Team Leader (scoped to their own
 * team's roster — see getViewAsScope). */
export function canUseViewAs(email: string | null | undefined, roleName: string | null | undefined): boolean {
  const role = (roleName ?? "").trim().toLowerCase();
  if (role === "full stack developer") return true;
  if (role.includes("sales manager")) return true;
  if (role.includes("team leader")) return true;
  return !!email && VIEW_AS_EMAIL_ALLOWLIST.has(email.toLowerCase());
}

export type ViewAsScope =
  | { kind: "all" }
  // The whole sales org — every Sales Executive plus every Team Leader —
  // for a Sales Manager. Not "all": she oversees the sales floor, not FSDs,
  // marketing, or any other department.
  | { kind: "sales-floor" }
  | { kind: "team"; teamId: string | null; memberIds: string[] };

/**
 * What an approved View As user may actually pick from. Full Stack
 * Developers and the explicit email allowlist get the whole company
 * roster; a Sales Manager gets every Sales Executive and Team Leader
 * company-wide (she oversees the whole sales floor, same "company" scope
 * getPackageReviewScope already grants her elsewhere); a Team Leader is
 * scoped to only the SalesTeam they lead (empty roster if they don't
 * currently lead one, same "none" fallback getPackageReviewScope uses).
 * Returns null if the caller can't use View As at all — callers should
 * treat that the same as an empty roster.
 */
export async function getViewAsScope(
  email: string,
  memberId: string,
  roleName: string | null | undefined,
): Promise<ViewAsScope | null> {
  if (!canUseViewAs(email, roleName)) return null;

  const role = (roleName ?? "").trim().toLowerCase();
  if (role === "full stack developer" || VIEW_AS_EMAIL_ALLOWLIST.has(email.toLowerCase())) {
    return { kind: "all" };
  }

  if (role.includes("sales manager")) {
    return { kind: "sales-floor" };
  }

  if (role.includes("team leader")) {
    const leader = await db.teamMember.findUnique({
      where: { id: memberId },
      select: { ledSalesTeam: { select: { id: true, members: { select: { id: true } } } } },
    });
    if (!leader?.ledSalesTeam) return { kind: "team", teamId: null, memberIds: [] };
    return {
      kind: "team",
      teamId: leader.ledSalesTeam.id,
      memberIds: leader.ledSalesTeam.members.map((m) => m.id),
    };
  }

  return { kind: "team", teamId: null, memberIds: [] };
}

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

  if (canUseViewAs(realMember.email, realMember.teamRole?.name)) {
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
