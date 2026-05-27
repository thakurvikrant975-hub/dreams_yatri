// app/(dashboard)/dashboard/(main)/lib/get-current-member.ts
import "server-only";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";
import type { Session } from "next-auth";

export async function getCurrentMember(session?: Session | null) {
  const resolvedSession = session ?? await dashboardAuth();
  if (!resolvedSession?.user?.email) return null;

  const member = await db.teamMember.findUnique({
    where: { email: resolvedSession.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      joiningDate: true,
      lastLoginAt: true,
      profilePicKey: true,  // ← add
      profilePicUrl: true,  // ← add
      department: {
        select: { id: true, name: true },
      },
      teamRole: {
        select: { id: true, name: true, permissions: true },
      },
    },
  });

  return member;
}