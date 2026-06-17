"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";

const COOKIE = "dy_view_as";

async function assertFSD(): Promise<boolean> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return false;
  const m = await db.teamMember.findUnique({
    where: { email: session.user.email },
    select: { teamRole: { select: { name: true } } },
  });
  return m?.teamRole?.name?.toLowerCase() === "full stack developer";
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
  if (!(await assertFSD())) return [];
  return db.teamMember.findMany({
    where: { isActive: true },
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
  if (!(await assertFSD())) return { success: false };
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
