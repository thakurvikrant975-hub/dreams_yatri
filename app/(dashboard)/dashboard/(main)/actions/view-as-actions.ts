"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";
import { getViewAsScope, type ViewAsScope } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";

const COOKIE = "dy_view_as";

/** Resolves the caller's View As scope — null if they aren't allowed to use
 * it at all, otherwise "all" (FSD / allowlist) or "team" (a Team Leader,
 * restricted to the roster of the team they lead). */
async function currentScope(): Promise<ViewAsScope | null> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;
  const m = await db.teamMember.findUnique({
    where: { email: session.user.email },
    select: { id: true, teamRole: { select: { name: true } } },
  });
  if (!m) return null;
  return getViewAsScope(session.user.email, m.id, m.teamRole?.name);
}

export type ViewableMember = {
  id: string;
  name: string;
  email: string;
  profilePicUrl: string | null;
  designation: string | null;
  teamRole: { name: string } | null;
  department: { name: string } | null;
};

export async function getViewableMembers(): Promise<ViewableMember[]> {
  const scope = await currentScope();
  if (!scope) return [];
  if (scope.kind === "team" && scope.memberIds.length === 0) return [];
  return db.teamMember.findMany({
    where: {
      isActive: true,
      ...(scope.kind === "team" ? { id: { in: scope.memberIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicUrl: true,
      designation: true,
      teamRole: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function startViewingAs(memberId: string): Promise<{ success: boolean }> {
  const scope = await currentScope();
  if (!scope) return { success: false };
  // A Team Leader may only View As someone on the team they lead — re-checked
  // here (not just in the picker's list) since this action can be called
  // directly with any id.
  if (scope.kind === "team" && !scope.memberIds.includes(memberId)) return { success: false };
  const exists = await db.teamMember.count({ where: { id: memberId } });
  if (!exists) return { success: false };
  (await cookies()).set(COOKIE, memberId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/dashboard",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function stopViewingAs(): Promise<{ success: boolean }> {
  // Must use the same path the cookie was set with, otherwise the browser ignores the delete.
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/dashboard",
    maxAge: 0,
  });
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
