"use server";

// (main)/verify-packages/actions.ts
//
// Internal pricing double-check for custom packages a sales exec has sent to
// a client — independent of the client-facing status (SENT/ACCEPTED/DECLINED).

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentActor, type ActionResult } from "../(marketing)/queries/actions";
import { actionError } from "@/app/lib/action-error";

export async function verifyCustomPackage(packageId: string): Promise<ActionResult> {
    try {
        const { actor } = await getCurrentActor();

        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: { id: true, sentAt: true, verified: true },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (!pkg.sentAt) return { success: false, message: "This package hasn't been sent to the client yet" };
        if (pkg.verified) return { success: false, message: "Already verified" };

        await db.custom_packages.update({
            where: { id: packageId },
            data: {
                verified: true,
                verifiedAt: new Date(),
                verifiedBy: actor?.id ?? null,
                verifiedByName: actor?.name ?? null,
            },
        });

        revalidatePath("/dashboard/verify-packages");
        revalidatePath(`/dashboard/verify-packages/${packageId}`);
        return { success: true, data: undefined, message: "Package marked as verified" };
    } catch (e) {
        console.error("[verifyCustomPackage] FAILED:", e);
        return actionError(e);
    }
}
