"use server";

import { dashboardAuth, dashboardSignOut } from "./auth-dashboard";
import { db } from "@/app/lib/db";
import { stampLogout } from "@/app/lib/auth/attendance";

export async function signOutEmployee() {
  const session = await dashboardAuth();
  const email = session?.user?.email;
  if (email) {
    const member = await db.teamMember.findUnique({ where: { email }, select: { id: true } });
    if (member) await stampLogout(member.id).catch(console.error);
  }
  await dashboardSignOut({ redirectTo: "/dashboard/login" });
}
