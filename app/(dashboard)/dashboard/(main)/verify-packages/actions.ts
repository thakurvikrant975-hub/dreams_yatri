"use server";

// (main)/verify-packages/actions.ts
//
// Mandatory pre-send pricing review for custom packages a sales exec has
// marked ready — nothing reaches the client until the costing team either
// approves it (locks in the pricing sign-off, but does NOT send anything —
// the exec triggers the actual send from the package builder via
// shareCustomPackageWithClient) or rejects it with a reason, which kicks it
// back to the exec as a DRAFT they can edit and resubmit. Costing can also
// correct pricing errors directly here (margin/GST, hotel/cab subtotal,
// ticket fares, add-on price+qty) before approving.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/app/lib/db";
import { getCurrentActor, logTimeline, type ActionResult } from "../(marketing)/queries/actions";
import { actionError } from "@/app/lib/action-error";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { createLog } from "../lib/logger";
import { computeFinalPackagePricing } from "@/app/services/package-pricing.service";

// Entity name pricing corrections are logged under in ActivityLog — kept
// distinct from "custom_package" so this history can be queried and shown
// only on the costing review page (getPackagePricingHistory below), never
// surfaced to the sales exec in the package builder.
const PRICING_HISTORY_ENTITY = "CustomPackagePricing";

function revalidateAll(packageId: string) {
    revalidatePath("/dashboard/verify-packages");
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    revalidatePath("/dashboard/sales-query");
    revalidatePath("/dashboard/package-builder");
    revalidatePath(`/dashboard/package-builder/${packageId}`);
}

// ── Approve (pricing sign-off — does not send anything to the client) ───────

export async function approveCustomPackage(packageId: string): Promise<ActionResult> {
    try {
        const { actor } = await getCurrentActor();

        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: { id: true, status: true, queryId: true },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "This package isn't awaiting review — the exec needs to mark it ready first." };

        // Lock in the exact price this approval is signing off on — hotel/cab
        // overrides included — so the package builder and PDF viewer show the
        // real approved number instead of recomputing (and drifting from it
        // the moment catalog rates change) or falling back to whatever stale
        // price the exec typed in before this review even started.
        const finalPricing = await computeFinalPackagePricing(packageId);

        await db.custom_packages.update({
            where: { id: packageId },
            data: {
                verified: true,
                verifiedAt: new Date(),
                verifiedBy: actor?.id ?? null,
                verifiedByName: actor?.name ?? null,
                rejectedAt: null, rejectedBy: null, rejectedByName: null, rejectionReasonId: null, rejectionNote: null,
                revisionRequestedAt: null, revisionRequestedBy: null, revisionRequestedByName: null, revisionNote: null,
                execNotifiedAt: null, // fresh event — the exec's notification poller should surface it
                ...(finalPricing ? { pricePerPerson: finalPricing.pricePerPerson, totalPrice: finalPricing.totalPrice } : {}),
            },
        });

        if (pkg.queryId) {
            await logTimeline(pkg.queryId, `Package pricing approved by ${actor?.name ?? "team member"} — ready for the exec to share with the client`, actor?.id, actor?.name ?? undefined);
        }
        await broadcastVerificationCounts();

        revalidateAll(packageId);
        return { success: true, data: undefined, message: "Approved — the exec can now share this with the client" };
    } catch (e) {
        console.error("[approveCustomPackage] FAILED:", e);
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
                revisionRequestedAt: null, revisionRequestedBy: null, revisionRequestedByName: null, revisionNote: null,
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
        await broadcastVerificationCounts();

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
    // Per-day corrections — null means "no correction, use the catalog-
    // computed price for that day" (or clears a previously-set correction).
    hotelDayOverrides: z.array(z.object({ day: z.number().int(), amount: z.coerce.number().min(0).nullable() })),
    cabDayOverrides: z.array(z.object({ day: z.number().int(), amount: z.coerce.number().min(0).nullable() })),
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
                id: true, status: true, queryId: true, title: true,
                marginPercentage: true, gstPercentage: true,
                tickets: { select: { id: true, fare: true, type: true, fromPlace: true, toPlace: true } },
                addOns: { select: { id: true, name: true, price: true, quantity: true } },
                itineraries: { select: { day: true, hotelPriceOverride: true, cabPriceOverride: true } },
            },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "Pricing can only be corrected while a package is awaiting review." };

        const validTicketIds = new Set(pkg.tickets.map((t) => t.id));
        const validAddonIds = new Set(pkg.addOns.map((a) => a.id));
        const validDays = new Set(pkg.itineraries.map((it) => it.day));
        if (
            data.tickets.some((t) => !validTicketIds.has(t.id)) ||
            data.addOns.some((a) => !validAddonIds.has(a.id)) ||
            data.hotelDayOverrides.some((o) => !validDays.has(o.day)) ||
            data.cabDayOverrides.some((o) => !validDays.has(o.day))
        ) {
            return { success: false, message: "Stale form data — please refresh and try again" };
        }

        // Flat before/after snapshot for the costing-only pricing history
        // (ActivityLog's ChangeSummary UI auto-filters to only the keys that
        // actually changed, so it's fine to include every field here).
        const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
        const ticketLabel = (t: { id: string; type: string; fromPlace: string | null; toPlace: string | null }) =>
            `Ticket: ${t.type}${t.fromPlace && t.toPlace ? ` (${t.fromPlace} → ${t.toPlace})` : ""} [${t.id.slice(-4)}]`;
        const addonLabel = (a: { id: string; name: string }) => `Add-on: ${a.name} [${a.id.slice(-4)}]`;

        const previousData: Record<string, string> = {
            "Margin": `${pkg.marginPercentage}%`,
            "GST": `${pkg.gstPercentage}%`,
        };
        const newData: Record<string, string> = {
            "Margin": `${data.marginPercentage}%`,
            "GST": `${data.gstPercentage}%`,
        };
        const itineraryByDay = new Map(pkg.itineraries.map((it) => [it.day, it]));
        for (const o of data.hotelDayOverrides) {
            const label = `Hotel — Day ${o.day}`;
            previousData[label] = itineraryByDay.get(o.day)?.hotelPriceOverride != null ? rupee(itineraryByDay.get(o.day)!.hotelPriceOverride!) : "catalog price";
            newData[label] = o.amount != null ? rupee(o.amount) : "catalog price";
        }
        for (const o of data.cabDayOverrides) {
            const label = `Cab — Day ${o.day}`;
            previousData[label] = itineraryByDay.get(o.day)?.cabPriceOverride != null ? rupee(itineraryByDay.get(o.day)!.cabPriceOverride!) : "catalog price";
            newData[label] = o.amount != null ? rupee(o.amount) : "catalog price";
        }
        for (const t of pkg.tickets) {
            const edit = data.tickets.find((x) => x.id === t.id);
            if (!edit) continue;
            const label = ticketLabel(t);
            previousData[label] = rupee(t.fare ?? 0);
            newData[label] = rupee(edit.fare);
        }
        for (const a of pkg.addOns) {
            const edit = data.addOns.find((x) => x.id === a.id);
            if (!edit) continue;
            const label = addonLabel(a);
            previousData[label] = `${rupee(a.price)} × ${a.quantity}`;
            newData[label] = `${rupee(edit.price)} × ${edit.quantity}`;
        }

        // Ticket fares / add-on price+qty are real fields — write straight
        // through. Hotel/cab corrections are per-day (see hotelPriceOverride/
        // cabPriceOverride on custom_itineraries) — null clears back to the
        // catalog-computed price for that day. The old package-wide lump
        // override fields are retired here (nulled out) now that per-day
        // granularity is the mechanism — leaving a stale lump override set
        // would otherwise silently outrank these per-day corrections (see
        // computeFinalPackagePricing's `pkg.hotelSubtotalOverride ?? …`).
        await Promise.all([
            ...data.tickets.map((t) => db.custom_package_tickets.update({ where: { id: t.id }, data: { fare: t.fare } })),
            ...data.addOns.map((a) => db.custom_package_addons.update({ where: { id: a.id }, data: { price: a.price, quantity: a.quantity } })),
            ...data.hotelDayOverrides.map((o) =>
                db.custom_itineraries.updateMany({ where: { customPackageId: packageId, day: o.day }, data: { hotelPriceOverride: o.amount } })),
            ...data.cabDayOverrides.map((o) =>
                db.custom_itineraries.updateMany({ where: { customPackageId: packageId, day: o.day }, data: { cabPriceOverride: o.amount } })),
            db.custom_packages.update({
                where: { id: packageId },
                data: {
                    marginPercentage: data.marginPercentage,
                    gstPercentage: data.gstPercentage,
                    hotelSubtotalOverride: null,
                    cabSubtotalOverride: null,
                },
            }),
        ]);

        // Re-lock the final price against what was just saved — otherwise the
        // package builder and PDF viewer keep showing whatever price existed
        // before this correction (either a stale exec-typed number, or a
        // catalog-only total that ignores the override just set above).
        const finalPricing = await computeFinalPackagePricing(packageId);
        if (finalPricing) {
            await db.custom_packages.update({
                where: { id: packageId },
                data: { pricePerPerson: finalPricing.pricePerPerson, totalPrice: finalPricing.totalPrice },
            });
        }

        if (pkg.queryId) {
            await logTimeline(
                pkg.queryId,
                `Package pricing corrected during review by ${actor?.name ?? "team member"}`,
                actor?.id, actor?.name ?? undefined,
            );
        }

        const actuallyChanged = Object.keys(newData).some((k) => previousData[k] !== newData[k]);
        if (actuallyChanged) {
            await createLog({
                action: "UPDATE",
                entity: PRICING_HISTORY_ENTITY,
                entityId: packageId,
                entitySlug: pkg.title,
                description: `${actor?.name ?? "Costing"} corrected pricing during review`,
                previousData,
                newData,
            });
        }

        revalidateAll(packageId);
        return { success: true, data: undefined, message: "Pricing updated" };
    } catch (e) {
        console.error("[updatePackagePricing] FAILED:", e);
        return actionError(e);
    }
}

// ── Pricing history (costing-only — never surfaced to the sales exec) ──────

export async function getPackagePricingHistory(packageId: string | number) {
    return db.activityLog.findMany({
        where: { entity: PRICING_HISTORY_ENTITY, entityId: String(packageId) },
        orderBy: { actionAt: "desc" },
        select: {
            id: true,
            action: true,
            description: true,
            userName: true,
            userEmail: true,
            previousData: true,
            newData: true,
            metadata: true,
            status: true,
            actionAt: true,
        },
        take: 50,
    });
}
