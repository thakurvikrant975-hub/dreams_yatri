// app/lib/auth/session.ts
import { db } from "@/app/lib/db";
import { PermissionSet } from "@/types/rbac";

export async function getMemberWithPermissions(email: string) {
  const member = await db.teamMember.findUnique({
    where: { email },
    include: {
      teamRole: { select: { permissions: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!member) return null;

  const permissions: PermissionSet =
    (member.teamRole?.permissions as PermissionSet) ?? [];

  return { ...member, permissions };
}