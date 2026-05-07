// app/(dashboard)/dashboard/(main)/lib/get-current-member.ts
import "server-only";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";

export async function getCurrentMember() {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;

  const member = await db.teamMember.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      joiningDate: true,
      lastLoginAt: true,
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