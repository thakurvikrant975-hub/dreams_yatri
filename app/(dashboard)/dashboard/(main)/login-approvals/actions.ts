"use server";

import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";

export type PendingLoginApproval = {
  id: string;
  memberId: string;
  memberName: string;
  roleName: string | null;
  reason: "LATE_LOGIN" | "AUTO_LOGOUT";
  forDate: string;
  requestedAt: string;
};

async function requireSalesManager(): Promise<{ ok: true; actorId: string } | { ok: false; message: string }> {
  const session = await dashboardAuth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!role || role.toLowerCase() !== "sales manager") {
    return { ok: false, message: "Only a Sales Manager can approve login requests." };
  }
  const email = session?.user?.email;
  const member = email ? await db.teamMember.findUnique({ where: { email }, select: { id: true } }) : null;
  if (!member) return { ok: false, message: "Could not identify the current user." };
  return { ok: true, actorId: member.id };
}

export async function getPendingLoginApprovals(): Promise<PendingLoginApproval[]> {
  const rows = await db.loginApprovalRequest.findMany({
    where: { status: "PENDING" },
    include: { member: { select: { name: true, teamRole: { select: { name: true } } } } },
    orderBy: { requestedAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    memberName: r.member.name,
    roleName: r.member.teamRole?.name ?? null,
    reason: r.reason,
    forDate: r.forDate.toISOString(),
    requestedAt: r.requestedAt.toISOString(),
  }));
}

export async function approveLoginRequest(id: string): Promise<{ success: boolean; message: string }> {
  const gate = await requireSalesManager();
  if (!gate.ok) return { success: false, message: gate.message };

  const req = await db.loginApprovalRequest.findUnique({ where: { id } });
  if (!req) return { success: false, message: "Request not found" };

  await db.$transaction([
    db.loginApprovalRequest.update({
      where: { id },
      data: { status: "APPROVED", decidedAt: new Date(), decidedBy: gate.actorId },
    }),
    ...(req.reason === "AUTO_LOGOUT"
      ? [db.teamMember.update({ where: { id: req.memberId }, data: { pendingReloginApproval: false } })]
      : []),
  ]);

  revalidatePath("/dashboard/login-approvals");
  return { success: true, message: "Approved" };
}

export async function denyLoginRequest(id: string): Promise<{ success: boolean; message: string }> {
  const gate = await requireSalesManager();
  if (!gate.ok) return { success: false, message: gate.message };

  const req = await db.loginApprovalRequest.findUnique({ where: { id } });
  if (!req) return { success: false, message: "Request not found" };

  await db.loginApprovalRequest.update({
    where: { id },
    data: { status: "DENIED", decidedAt: new Date(), decidedBy: gate.actorId },
  });

  revalidatePath("/dashboard/login-approvals");
  return { success: true, message: "Denied" };
}
