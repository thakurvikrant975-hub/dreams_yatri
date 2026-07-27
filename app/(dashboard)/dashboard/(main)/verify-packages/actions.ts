"use server";

// (main)/verify-packages/actions.ts
//
// Mandatory pre-send pricing review for custom packages a sales exec has
// marked ready — nothing reaches the client until the costing team either
// verifies-and-sends it (locks pricing + notifies the client, all in one
// action) or rejects it with a reason, which kicks it back to the exec as a
// DRAFT they can edit and resubmit. Costing can also correct pricing errors
// directly here (margin/GST, hotel/cab subtotal, ticket fares, add-on
// price+qty) before verifying.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/app/lib/db";
import { getCurrentActor, logTimeline, type ActionResult } from "../(marketing)/queries/actions";
import { actionError } from "@/app/lib/action-error";
import { sendPackageToClient } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { emailPackageToClient } from "@/app/(dashboard)/dashboard/(builder)/package-builder/email-package";

function revalidateAll(packageId: string) {
    revalidatePath("/dashboard/verify-packages");
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    revalidatePath("/dashboard/sales-query");
    revalidatePath("/dashboard/package-builder");
    revalidatePath(`/dashboard/package-builder/${packageId}`);
}

// ── Verify and send ──────────────────────────────────────────────────────────

export async function verifyAndSendPackage(packageId: string): Promise<ActionResult<{ whatsappUrl?: string; shareUrl?: string }>> {
    try {
        const { actor } = await getCurrentActor();

        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: { id: true, status: true, queryId: true },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "This package isn't awaiting review — the exec needs to mark it ready first." };

        // Does the real work: recomputes pricing fresh (respecting any
        // hotel/cab override set below via updatePackagePricing), locks the
        // snapshot, sets status SENT, builds the WhatsApp link. Identical to
        // what the old sales-exec-triggered "Send to Client" used to call —
        // the only thing that changed is WHO can trigger it and WHEN.
        const sendResult = await sendPackageToClient(packageId);
        if (!sendResult.success) {
            return { success: false, message: sendResult.error ?? "Failed to send package" };
        }

        await db.custom_packages.update({
            where: { id: packageId },
            data: {
                verified: true,
                verifiedAt: new Date(),
                verifiedBy: actor?.id ?? null,
                verifiedByName: actor?.name ?? null,
                rejectedAt: null, rejectedBy: null, rejectedByName: null, rejectionReasonId: null, rejectionNote: null,
                execNotifiedAt: null, // fresh event — the exec's notification poller should surface it
            },
        });

        // Best-effort — an email failure shouldn't undo the verify-and-send;
        // the WhatsApp link is still handed back either way, and the client
        // link itself is now live regardless of whether the email lands.
        try {
            await emailPackageToClient(packageId);
        } catch (e) {
            console.error("[verifyAndSendPackage] email failed", e);
        }

        if (pkg.queryId) {
            await logTimeline(pkg.queryId, `Package verified and sent to client by ${actor?.name ?? "team member"}`, actor?.id, actor?.name ?? undefined);
        }

        revalidateAll(packageId);
        return {
            success: true,
            data: { whatsappUrl: sendResult.whatsappUrl, shareUrl: sendResult.shareUrl },
            message: "Verified and sent to client",
        };
    } catch (e) {
        console.error("[verifyAndSendPackage] FAILED:", e);
        return actionError(e);
    }
}

// ── Reject (send back to the exec for rework) ───────────────────────────────

const rejectPackageSchema = z.object({
    rejectionReasonId: z.string().min(1, "Select a rejection reason"),
    rejectionNote: z.string().max(500).optional(),
});

export async function rejectCustomPackage(packageId: string, formData: FormData): Promise<ActionResult> {
    const parsed = rejectPackageSchema.safeParse({
        rejectionReasonId: formData.get("rejectionReasonId"),
        rejectionNote: formData.get("rejectionNote") || undefined,
    });
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { actor } = await getCurrentActor();
        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: { id: true, status: true, queryId: true },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "This package isn't awaiting review." };

        const reason = await db.rejectionReason.findUnique({ where: { id: parsed.data.rejectionReasonId } });

        await db.custom_packages.update({
            where: { id: packageId },
            data: {
                // Back to DRAFT — this is what unlocks editing again in the
                // builder (locked whenever status is READY) and drops it out
                // of the verify-packages "pending" queue.
                status: "DRAFT",
                verified: false, verifiedAt: null, verifiedBy: null, verifiedByName: null,
                rejectedAt: new Date(),
                rejectedBy: actor?.id ?? null,
                rejectedByName: actor?.name ?? null,
                rejectionReasonId: parsed.data.rejectionReasonId,
                rejectionNote: parsed.data.rejectionNote ?? null,
                execNotifiedAt: null,
            },
        });

        if (pkg.queryId) {
            await logTimeline(
                pkg.queryId,
                `Package sent back for rework by ${actor?.name ?? "team member"} — ${reason?.label ?? "Unknown reason"}${parsed.data.rejectionNote ? ` · Note: ${parsed.data.rejectionNote}` : ""}`,
                actor?.id, actor?.name ?? undefined,
                { reason: reason?.label, note: parsed.data.rejectionNote },
            );
        }

        revalidateAll(packageId);
        return { success: true, data: undefined, message: "Package sent back for rework" };
    } catch (e) {
        console.error("[rejectCustomPackage] FAILED:", e);
        return actionError(e);
    }
}

// ── Pricing correction (costing team fixing sales-exec entry errors, pre-send) ──

const pricingEditSchema = z.object({
    marginPercentage: z.coerce.number().min(0).max(100),
    gstPercentage: z.coerce.number().min(0).max(100),
    hotelSubtotal: z.coerce.number().min(0),
    cabSubtotal: z.coerce.number().min(0),
    tickets: z.array(z.object({ id: z.string(), fare: z.coerce.number().min(0) })),
    addOns: z.array(z.object({ id: z.string(), price: z.coerce.number().min(0), quantity: z.coerce.number().int().min(1) })),
});

export type PricingEditInput = z.infer<typeof pricingEditSchema>;

export async function updatePackagePricing(packageId: string, input: PricingEditInput): Promise<ActionResult> {
    const parsed = pricingEditSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }
    const data = parsed.data;

    try {
        const { actor } = await getCurrentActor();
        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: {
                id: true, status: true, queryId: true,
                tickets: { select: { id: true } },
                addOns: { select: { id: true } },
            },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "Pricing can only be corrected while a package is awaiting review." };

        const validTicketIds = new Set(pkg.tickets.map((t) => t.id));
        const validAddonIds = new Set(pkg.addOns.map((a) => a.id));
        if (data.tickets.some((t) => !validTicketIds.has(t.id)) || data.addOns.some((a) => !validAddonIds.has(a.id))) {
            return { success: false, message: "Stale form data — please refresh and try again" };
        }

        // Ticket fares / add-on price+qty are real fields — write straight
        // through. Hotel/cab are computed live from the itinerary (catalog
        // rates × occupancy), so a correction there is stored as an override
        // that sendPackageToClient applies at verify-and-send time (see
        // hotelSubtotalOverride/cabSubtotalOverride on the schema).
        await Promise.all([
            ...data.tickets.map((t) => db.custom_package_tickets.update({ where: { id: t.id }, data: { fare: t.fare } })),
            ...data.addOns.map((a) => db.custom_package_addons.update({ where: { id: a.id }, data: { price: a.price, quantity: a.quantity } })),
            db.custom_packages.update({
                where: { id: packageId },
                data: {
                    marginPercentage: data.marginPercentage,
                    gstPercentage: data.gstPercentage,
                    hotelSubtotalOverride: data.hotelSubtotal,
                    cabSubtotalOverride: data.cabSubtotal,
                },
            }),
        ]);

        if (pkg.queryId) {
            await logTimeline(
                pkg.queryId,
                `Package pricing corrected during review by ${actor?.name ?? "team member"}`,
                actor?.id, actor?.name ?? undefined,
            );
        }

        revalidateAll(packageId);
        return { success: true, data: undefined, message: "Pricing updated" };
    } catch (e) {
        console.error("[updatePackagePricing] FAILED:", e);
        return actionError(e);
    }
}
