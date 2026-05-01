// app/dashboard/actions/member-actions.ts
"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

export async function toggleMemberStatus(
  memberId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.teamMember.update({
      where: { id: memberId },
      data: { isActive },
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("toggleMemberStatus error:", err);
    return { success: false, error: "Failed to update status" };
  }
}