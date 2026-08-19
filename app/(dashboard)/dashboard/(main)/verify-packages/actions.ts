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
import { computeFinalPackagePricing, persistStayOptionPricing } from "@/app/services/package-pricing.service";
import { getItinerarySettings } from "../itinerary-settings/actions";
import { getEffectiveMember } from "../lib/get-current-member";
import {
    resolveWorkspaceCaps, workspaceRoleOf,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/workspace-caps";

/** Re-derives the caller's capabilities against this package, server-side.
 *
 * The three actions below — approve, reject, correct pricing — used to check
 * only that the package was at READY, never who was asking. The buttons live
 * behind a costing-only tab, but a hidden button is a courtesy, not a
 * permission: any signed-in dashboard user could call these directly and sign
 * off a package's pricing for send.
 *
 * Follows the effective member, so a Full Stack Developer using "View As" gets
 * the capabilities of whoever they are standing in for — the same rule the
 * builder route and review-notes.actions.ts already use. */
async function decideCapsFor(packageId: string) {
    const [memberCtx, pkg] = await Promise.all([
        getEffectiveMember(),
        db.custom_packages.findUnique({
            where: { id: packageId },
            select: { status: true, verified: true, rejectedAt: true, revisionRequestedAt: true },
        }),
    ]);
    if (!pkg) return null;
    return resolveWorkspaceCaps(workspaceRoleOf(memberCtx?.member?.teamRole?.name), {
        status: pkg.status,
        verified: pkg.verified,
        rejectedAt: pkg.rejectedAt,
        revisionRequestedAt: pkg.revisionRequestedAt,
    });
}

const NOT_COSTING = "Only the costing team can review a package's pricing.";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

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
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
}

// ── Approve (pricing sign-off — does not send anything to the client) ───────

export async function approveCustomPackage(packageId: string): Promise<ActionResult> {
    try {
        const { actor } = await getCurrentActor();

        const pkg = await db.custom_packages.findUnique({
            where: { id: packageId },
            select: { id: true, status: true, queryId: true, totalPrice: true, title: true },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "This package isn't awaiting review — the exec needs to mark it ready first." };

        const caps = await decideCapsFor(packageId);
        if (!caps?.decide) return { success: false, message: NOT_COSTING };

        // Lock in the exact price this approval is signing off on — hotel/cab
        // overrides included — so the package builder and PDF viewer show the
        // real approved number instead of recomputing (and drifting from it
        // the moment catalog rates change) or falling back to whatever stale
        // price the exec typed in before this review even started.
        const finalPricing = await computeFinalPackagePricing(packageId);

        // Every stay option re-priced against the same margin, GST and
        // corrections this approval locks in. Without it the options keep the
        // figures frozen when the exec submitted, so the client's comparison
        // would quote standards priced on the pre-review numbers while the
        // headline showed the approved one.
        await persistStayOptionPricing(packageId).catch((err) => {
            // Never block an approval on this: the package's own price is
            // authoritative, and an option with no stored figure falls back to
            // a live computation wherever it is shown.
            console.error("[approveCustomPackage] stay option pricing", err);
        });

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

        // Approving can change the price, and used to do it silently. The write
        // above replaces whatever the exec had typed with the recomputed
        // figure; if the two differ, the exec's next sight of their own package
        // is a different number with nothing saying why. Say it — in the toast
        // costing sees, in the timeline the exec reads, and in the pricing
        // history, so the change is attributable afterwards.
        const priceMoved =
            finalPricing != null && pkg.totalPrice != null &&
            Math.round(pkg.totalPrice) !== Math.round(finalPricing.totalPrice);
        const priceNote = priceMoved
            ? ` Price updated from ${inr(pkg.totalPrice!)} to ${inr(finalPricing!.totalPrice)} on approval.`
            : "";

        if (pkg.queryId) {
            await logTimeline(
                pkg.queryId,
                `Package pricing approved by ${actor?.name ?? "team member"} — ready for the exec to share with the client.${priceNote}`,
                actor?.id, actor?.name ?? undefined,
            );
        }
        if (priceMoved) {
            await createLog({
                action: "UPDATE",
                entity: PRICING_HISTORY_ENTITY,
                entityId: packageId,
                entitySlug: pkg.title,
                description: `Price recomputed on approval by ${actor?.name ?? "Costing"}`,
                previousData: { "Total price": inr(pkg.totalPrice!) },
                newData: { "Total price": inr(finalPricing!.totalPrice) },
            });
        }
        await broadcastVerificationCounts();

        revalidateAll(packageId);
        return {
            success: true, data: undefined,
            message: `Approved — the exec can now share this with the client.${priceNote}`,
        };
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

        const caps = await decideCapsFor(packageId);
        if (!caps?.decide) return { success: false, message: NOT_COSTING };

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
    // Costing's concession off the final price. Null type = no discount, and
    // clears any previous one. PERCENT is capped at 100 here rather than only
    // being clamped downstream: applyDiscount floors the payable figure at
    // zero, so a mistyped 200% would silently produce a ₹0 package that
    // checkout then refuses with "this package doesn't have a price set yet".
    discountType: z.enum(["FLAT", "PERCENT"]).nullable(),
    discountValue: z.coerce.number().min(0).nullable(),
    discountNote: z.string().max(500).optional(),
    // Per-day corrections — null means "no correction, use the catalog-
    // computed price for that day" (or clears a previously-set correction).
    hotelDayOverrides: z.array(z.object({ day: z.number().int(), amount: z.coerce.number().min(0).nullable() })),
    cabDayOverrides: z.array(z.object({ day: z.number().int(), amount: z.coerce.number().min(0).nullable() })),
    tickets: z.array(z.object({ id: z.string(), fare: z.coerce.number().min(0) })),
    addOns: z.array(z.object({ id: z.string(), price: z.coerce.number().min(0), quantity: z.coerce.number().int().min(1) })),
}).refine(
    (d) => d.discountType !== "PERCENT" || (d.discountValue ?? 0) <= 100,
    { path: ["discountValue"], message: "A percentage discount can't exceed 100%" },
);

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
                discountType: true, discountValue: true, discountNote: true,
                tickets: { select: { id: true, fare: true, type: true, fromPlace: true, toPlace: true } },
                addOns: { select: { id: true, name: true, price: true, quantity: true } },
                itineraries: { select: { day: true, hotelPriceOverride: true, cabPriceOverride: true } },
            },
        });
        if (!pkg) return { success: false, message: "Package not found" };
        if (pkg.status !== "READY") return { success: false, message: "Pricing can only be corrected while a package is awaiting review." };

        // Margin, GST and the discount are costing's levers — see the caps
        // model. editMargin rather than decide: correcting a price is a
        // different act from signing it off, even though the same role does both.
        const caps = await decideCapsFor(packageId);
        if (!caps?.editMargin) return { success: false, message: NOT_COSTING };

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

        // A concession is the single most reviewable thing on this screen, so
        // it is recorded in the same before/after history as everything else —
        // who gave it, how much, and the internal reason they typed.
        const discountText = (type: "FLAT" | "PERCENT" | null, value: number | null) =>
            !type || value == null || value <= 0
                ? "none"
                : type === "PERCENT" ? `${value}% off` : `${rupee(value)} off`;

        const previousData: Record<string, string> = {
            "Margin": `${pkg.marginPercentage}%`,
            "GST": `${pkg.gstPercentage}%`,
            "Discount": discountText(pkg.discountType, pkg.discountValue),
            "Discount reason": pkg.discountNote ?? "—",
        };
        const newData: Record<string, string> = {
            "Margin": `${data.marginPercentage}%`,
            "GST": `${data.gstPercentage}%`,
            "Discount": discountText(data.discountType, data.discountValue ?? null),
            "Discount reason": data.discountNote?.trim() || "—",
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
                    // Clearing the type clears the value and the note with it —
                    // a stray amount left behind would reapply the moment a
                    // type was picked again.
                    discountType:  data.discountType,
                    discountValue: data.discountType ? (data.discountValue ?? null) : null,
                    discountNote:  data.discountType ? (data.discountNote?.trim() || null) : null,
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

        // The same correction applies to every option — margin, GST and the
        // discount are shared across them, only the hotels differ — so they are
        // re-frozen here too. Otherwise a margin change moved the headline and
        // left the alternatives quoting the old one.
        await persistStayOptionPricing(packageId).catch((err) => {
            console.error("[updatePackagePricing] stay option pricing", err);
        });

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

// ── Inclusions/Exclusions review (costing curating what the client sees) ───
//
// Standard inclusions/exclusions are company-wide (itinerary_settings) and a
// Sales Executive can only ever ADD to them for a package (extraPolicyItems),
// never remove one — see the Lock notice on the builder's Inclusions tab.
// Costing needs the opposite power here: drop a standard (or exec-added)
// line that doesn't actually apply to this specific package, without
// touching the global defaults every other package still uses. The client
// submits the FULL desired list per section; this diffs it against the live
// standard list to work out what's newly vetoed vs newly added, rather than
// trusting separate remove/add arrays from the client.

/** Mirrors ExtraPolicyItems in package-builder/action.ts — duplicated rather
 * than imported since normalizeExtraPolicyItems itself isn't exported from
 * that "use server" file (only async functions may be). */
type ExtraPolicyItems = {
  inclusions: string[]; exclusions: string[]; termsConditions: string[];
  paymentPolicy: string[]; amendmentPolicy: string[]; travelBenefits: string[];
};
function normalizeExtraPolicyItems(raw: unknown): ExtraPolicyItems {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ExtraPolicyItems, unknown>>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    inclusions: arr(obj.inclusions), exclusions: arr(obj.exclusions), termsConditions: arr(obj.termsConditions),
    paymentPolicy: arr(obj.paymentPolicy), amendmentPolicy: arr(obj.amendmentPolicy), travelBenefits: arr(obj.travelBenefits),
  };
}

const inclusionsExclusionsSchema = z.object({
  inclusions: z.array(z.string().trim().min(1)).max(100),
  exclusions: z.array(z.string().trim().min(1)).max(100),
});

export async function updatePackageInclusionsExclusions(
  packageId: string,
  input: z.infer<typeof inclusionsExclusionsSchema>,
): Promise<ActionResult> {
  const parsed = inclusionsExclusionsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    const { actor } = await getCurrentActor();
    const pkg = await db.custom_packages.findUnique({
      where: { id: packageId },
      select: { id: true, status: true, queryId: true, title: true, extraPolicyItems: true },
    });
    if (!pkg) return { success: false, message: "Package not found" };
    if (pkg.status !== "READY") return { success: false, message: "Inclusions/exclusions can only be corrected while a package is awaiting review." };

    const settings = await getItinerarySettings();
    const currentExtra = normalizeExtraPolicyItems(pkg.extraPolicyItems);

    // Standard-list items the reviewer dropped from the submitted list.
    const removedInclusions = settings.inclusions.filter((i) => !parsed.data.inclusions.includes(i));
    const removedExclusions = settings.exclusions.filter((e) => !parsed.data.exclusions.includes(e));
    // Whatever's left in the submitted list that isn't a standard item is
    // this package's additions — kept extras the reviewer didn't remove,
    // plus anything they freshly typed in.
    const newExtraInclusions = parsed.data.inclusions.filter((i) => !settings.inclusions.includes(i));
    const newExtraExclusions = parsed.data.exclusions.filter((e) => !settings.exclusions.includes(e));

    const changed = removedInclusions.length > 0 || removedExclusions.length > 0
      || newExtraInclusions.join("|") !== currentExtra.inclusions.join("|")
      || newExtraExclusions.join("|") !== currentExtra.exclusions.join("|");

    await db.custom_packages.update({
      where: { id: packageId },
      data: {
        removedInclusions,
        removedExclusions,
        extraPolicyItems: {
          ...currentExtra,
          inclusions: newExtraInclusions,
          exclusions: newExtraExclusions,
        },
      },
    });

    if (changed && pkg.queryId) {
      await logTimeline(
        pkg.queryId,
        `Inclusions/exclusions adjusted during review by ${actor?.name ?? "team member"}`,
        actor?.id, actor?.name ?? undefined,
      );
    }

    revalidateAll(packageId);
    return { success: true, data: undefined, message: "Inclusions & exclusions updated" };
  } catch (e) {
    console.error("[updatePackageInclusionsExclusions] FAILED:", e);
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
