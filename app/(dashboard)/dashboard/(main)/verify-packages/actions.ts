"use server";

// (main)/verify-packages/actions.ts
//
// Internal pricing double-check for custom packages a sales exec has sent to
// a client — independent of the client-facing status (SENT/ACCEPTED/DECLINED).
// Verification can end one of two ways: verified as-is, or rejected with a
// reason so the exec knows what to rework. The verification team can also
// correct pricing errors directly here (margin/GST/hotel/cab subtotals,
// ticket fares, add-on price+qty) before verifying — any correction resets
// the package to "pending" so the fix itself gets reviewed too.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { getCurrentActor, logTimeline, type ActionResult } from "../(marketing)/queries/actions";
import { actionError } from "@/app/lib/action-error";

// ── Shared final-pricing formula ────────────────────────────────────────────
// Mirrors computeFinalPricing in package-builder/[packageId]/page.tsx and the
// inline copy in package-builder/[packageId]/action.ts's sendPackageToClient —
// neither is exported for reuse, so this is a deliberate, small (10-line)
// duplication rather than reaching into the builder's client-component closure.
const TICKET_MARGIN_PCT = 5;

function computeFinalPricing(input: {
    hotelSubtotal: number;
    cabSubtotal: number;
    addonsSubtotal: number;
    ticketsSubtotal: number;
    marginPercentage: number;
    gstPercentage: number;
    totalPax: number;
}) {
    const hotelCabBase = input.hotelSubtotal + input.cabSubtotal;
    const baseCost = hotelCabBase + input.addonsSubtotal + input.ticketsSubtotal;
    const hotelCabMarginAmount = Math.round((hotelCabBase + input.addonsSubtotal) * input.marginPercentage / 100);
    const ticketsMarginAmount = Math.round(input.ticketsSubtotal * TICKET_MARGIN_PCT / 100);
    const marginAmount = hotelCabMarginAmount + ticketsMarginAmount;
    const taxable = baseCost + marginAmount;
    const gstAmount = Math.round(taxable * input.gstPercentage / 100);
    const finalPrice = taxable + gstAmount;
    const pricePerPerson = input.totalPax > 0 ? Math.round(finalPrice / input.totalPax) : finalPrice;
    return { baseCost, hotelCabMarginAmount, ticketsMarginAmount, marginAmount, taxable, gstAmount, finalPrice, pricePerPerson };
}

// ── Verify ───────────────────────────────────────────────────────────────────

export async function verifyCustomPackage(packageId: string): Promise<ActionResult> {
    try {
        const { actor } = await getCurrentActor();

        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: { id: true, sentAt: true, verified: true, queryId: true },
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
                rejectedAt: null, rejectedBy: null, rejectedByName: null,
                rejectionReasonId: null, rejectionNote: null,
            },
        });

        if (pkg.queryId) {
            await logTimeline(pkg.queryId, `Package pricing verified by ${actor?.name ?? "team member"}`, actor?.id, actor?.name ?? undefined);
        }

        revalidatePath("/dashboard/verify-packages");
        revalidatePath(`/dashboard/verify-packages/${packageId}`);
        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Package marked as verified" };
    } catch (e) {
        console.error("[verifyCustomPackage] FAILED:", e);
        return actionError(e);
    }
}

// ── Reject (send pricing back for rework) ───────────────────────────────────

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
            select: { id: true, sentAt: true, queryId: true },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (!pkg.sentAt) return { success: false, message: "This package hasn't been sent to the client yet" };

        const reason = await db.rejectionReason.findUnique({ where: { id: parsed.data.rejectionReasonId } });

        await db.custom_packages.update({
            where: { id: packageId },
            data: {
                verified: false, verifiedAt: null, verifiedBy: null, verifiedByName: null,
                rejectedAt: new Date(),
                rejectedBy: actor?.id ?? null,
                rejectedByName: actor?.name ?? null,
                rejectionReasonId: parsed.data.rejectionReasonId,
                rejectionNote: parsed.data.rejectionNote ?? null,
            },
        });

        if (pkg.queryId) {
            await logTimeline(
                pkg.queryId,
                `Package pricing sent back for rework by ${actor?.name ?? "team member"} — ${reason?.label ?? "Unknown reason"}${parsed.data.rejectionNote ? ` · Note: ${parsed.data.rejectionNote}` : ""}`,
                actor?.id, actor?.name ?? undefined,
                { reason: reason?.label, note: parsed.data.rejectionNote },
            );
        }

        revalidatePath("/dashboard/verify-packages");
        revalidatePath(`/dashboard/verify-packages/${packageId}`);
        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Package sent back for rework" };
    } catch (e) {
        console.error("[rejectCustomPackage] FAILED:", e);
        return actionError(e);
    }
}

// ── Pricing correction (verification team fixing sales-exec entry errors) ───

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
                id: true, sentAt: true, adults: true, children: true, queryId: true,
                pricingSnapshot: true,
                tickets: { select: { id: true } },
                addOns: { select: { id: true } },
            },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (!pkg.sentAt || !pkg.pricingSnapshot) return { success: false, message: "This package has no locked pricing to correct yet" };

        const validTicketIds = new Set(pkg.tickets.map((t) => t.id));
        const validAddonIds = new Set(pkg.addOns.map((a) => a.id));
        if (data.tickets.some((t) => !validTicketIds.has(t.id)) || data.addOns.some((a) => !validAddonIds.has(a.id))) {
            return { success: false, message: "Stale form data — please refresh and try again" };
        }

        // Write through to the real rows so a future re-open/re-send in
        // package-builder sees the correction too, not just this snapshot.
        await Promise.all([
            ...data.tickets.map((t) => db.custom_package_tickets.update({ where: { id: t.id }, data: { fare: t.fare } })),
            ...data.addOns.map((a) => db.custom_package_addons.update({ where: { id: a.id }, data: { price: a.price, quantity: a.quantity } })),
        ]);

        const [freshTickets, freshAddons] = await Promise.all([
            db.custom_package_tickets.findMany({ where: { customPackageId: packageId }, orderBy: { sortOrder: "asc" } }),
            db.custom_package_addons.findMany({ where: { customPackageId: packageId }, orderBy: { sortOrder: "asc" } }),
        ]);

        const ticketsSubtotal = freshTickets.reduce((sum, t) => sum + (t.fare ?? 0), 0);
        const addonsSubtotal = freshAddons.reduce((sum, a) => sum + a.price * (a.quantity || 1), 0);
        const totalPax = pkg.adults + pkg.children;

        const computed = computeFinalPricing({
            hotelSubtotal: data.hotelSubtotal,
            cabSubtotal: data.cabSubtotal,
            addonsSubtotal, ticketsSubtotal,
            marginPercentage: data.marginPercentage,
            gstPercentage: data.gstPercentage,
            totalPax,
        });

        const prev = pkg.pricingSnapshot as Record<string, any>;
        const nextSnapshot = {
            lockedAt: prev.lockedAt,
            currency: prev.currency,
            hotel: { subtotal: data.hotelSubtotal, nightsCounted: prev.hotel?.nightsCounted ?? 0, lines: prev.hotel?.lines ?? [] },
            cab: { subtotal: data.cabSubtotal, daysCounted: prev.cab?.daysCounted ?? 0, lines: prev.cab?.lines ?? [] },
            tickets: {
                subtotal: ticketsSubtotal,
                lines: freshTickets.map((t) => ({ type: t.type, provider: t.provider ?? "", fromPlace: t.fromPlace ?? "", toPlace: t.toPlace ?? "", fare: t.fare, ticketCount: t.ticketCount })),
            },
            addOns: {
                subtotal: addonsSubtotal,
                lines: freshAddons.map((a) => ({ name: a.name, price: a.price, quantity: a.quantity, day: a.day })),
            },
            baseCost: computed.baseCost,
            marginPercentage: data.marginPercentage,
            hotelCabMarginAmount: computed.hotelCabMarginAmount,
            ticketsMarginAmount: computed.ticketsMarginAmount,
            marginAmount: computed.marginAmount,
            taxable: computed.taxable,
            gstPercentage: data.gstPercentage,
            gstAmount: computed.gstAmount,
            finalPrice: computed.finalPrice,
            pricePerPerson: computed.pricePerPerson,
            displayedTotalPrice: prev.displayedTotalPrice ?? null,
            displayedPricePerPerson: prev.displayedPricePerPerson ?? null,
            hotelOverridden: data.hotelSubtotal !== Math.round((prev.hotel?.subtotal ?? 0)),
            cabOverridden: data.cabSubtotal !== Math.round((prev.cab?.subtotal ?? 0)),
            correctedAt: new Date().toISOString(),
            correctedByName: actor?.name ?? null,
        } as unknown as Prisma.InputJsonValue;

        await db.custom_packages.update({
            where: { id: packageId },
            data: {
                marginPercentage: data.marginPercentage,
                gstPercentage: data.gstPercentage,
                totalPrice: computed.finalPrice,
                pricePerPerson: computed.pricePerPerson,
                pricingSnapshot: nextSnapshot,
                // Numbers changed — needs a fresh look before it counts as verified again.
                verified: false, verifiedAt: null, verifiedBy: null, verifiedByName: null,
                rejectedAt: null, rejectedBy: null, rejectedByName: null, rejectionReasonId: null, rejectionNote: null,
            },
        });

        if (pkg.queryId) {
            await logTimeline(
                pkg.queryId,
                `Package pricing corrected during verification by ${actor?.name ?? "team member"} — new total ₹${Math.round(computed.finalPrice).toLocaleString("en-IN")}`,
                actor?.id, actor?.name ?? undefined,
            );
        }

        revalidatePath("/dashboard/verify-packages");
        revalidatePath(`/dashboard/verify-packages/${packageId}`);
        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Pricing updated" };
    } catch (e) {
        console.error("[updatePackagePricing] FAILED:", e);
        return actionError(e);
    }
}
