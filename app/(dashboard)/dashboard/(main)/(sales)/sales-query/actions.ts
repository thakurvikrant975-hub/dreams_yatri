"use server";

// (sales)/sales-query/actions.ts
//
// Imports all shared types + helpers directly from the marketing actions file.
// No duplication — only sales-specific logic lives here.

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";
import { tryCreateBookingFromConvertedQuery } from "@/app/lib/bookings/create-from-query";

// ── Import shared types from marketing actions ────────────────────────────────
// Types are erased at runtime so this import is safe even across route groups.

import type {
    ActionResult,
    PackageQuery,
    PackageQueryType,
    package_queries,
    PackageRequirements,
    RejectionReason,
    CloseReason,
    FollowUp,
    SalesMember,
    DestinationOption,
    PackageOption,
    QueryStatus,
    QuerySource,
    CallOutcome,
    ManualQueryFormState,
    RejectionReasonFormState,
} from "../../(marketing)/queries/actions";


// ── Import shared async functions from marketing actions ──────────────────────
// These are real server functions — imported and re-exported as async wrappers
// so "use server" stays happy (all exports must be async functions).

import {
    logTimeline        as _logTimeline,
    getCurrentActor    as _getCurrentActor,
    getQueryById       as _getQueryById,
    getCloseReasons    as _getCloseReasons,
    getRejectionReasons as _getRejectionReasons,
    getSalesMembers    as _getSalesMembers,
    getDestinationsForQuery  as _getDestinationsForQuery,
    getPackagesByDestination as _getPackagesByDestination,
    assignQuery        as _assignQuery,
} from "../../(marketing)/queries/actions";

// Async wrapper re-exports — satisfies "use server" (only async fns exported)
export async function logTimeline(...args: Parameters<typeof _logTimeline>) {
    return _logTimeline(...args);
}
export async function getCurrentActor() {
    return _getCurrentActor();
}
export async function getQueryById(id: string) {
    return _getQueryById(id);
}
export async function getCloseReasons(): Promise<CloseReason[]> {
    return _getCloseReasons();
}
export async function getRejectionReasons(): Promise<RejectionReason[]> {
    return _getRejectionReasons();
}
export async function getSalesMembers(): Promise<SalesMember[]> {
    return _getSalesMembers();
}
export async function getDestinationsForQuery(): Promise<DestinationOption[]> {
    return _getDestinationsForQuery();
}
export async function getPackagesByDestination(destinationId: number): Promise<PackageOption[]> {
    return _getPackagesByDestination(destinationId);
}
export async function assignQuery(
    queryId: string,
    memberId: string | null,
    setStatus = false,   // default false for sales — avoids overwriting mid-funnel status
): Promise<ActionResult> {
    return _assignQuery(queryId, memberId, setStatus);
}

// ── Sales READ ────────────────────────────────────────────────────────────────

export type SentPackageInfo = {
    id:             string;
    title:          string;
    status:         string;
    createdAt:      Date;
    sentAt:         Date | null;
    readyAt:        Date | null;
    totalPrice:     number | null;
    pricePerPerson: number | null;
    pdfUrl:         string | null;
    verified:            boolean;
    verifiedAt:          Date | null;
    verifiedByName:      string | null;
    rejectedAt:          Date | null;
    rejectedByName:      string | null;
    rejectionNote:       string | null;
    rejectionReasonLabel: string | null;
    /** Rolled up from this package's itineraries — "rejected" wins over
     * "pending" (most actionable first), which wins over "filled" (the
     * hotel team fulfilled at least one day this way, still worth showing
     * even once nothing's outstanding). Null if this package never had a
     * hotel-team request at all. See HotelRequestBadge. */
    hotelRequestStatus: "pending" | "rejected" | "filled" | null;
    /** The rejection note for display, when hotelRequestStatus is "rejected". */
    hotelRequestNote:   string | null;
    /** Which days are in that status, for a "Day 2, Day 4" style tooltip. */
    hotelRequestDays:   number[];
};

// A query can now have more than one package built for it (e.g. two
// different budget options sent to the same client) — most recent first.
export type SalesQueryRow = PackageQuery & { customPackages: SentPackageInfo[] };

const CUSTOM_PACKAGE_SELECT = {
    id: true, title: true, status: true, createdAt: true, sentAt: true, readyAt: true,
    totalPrice: true, pricePerPerson: true, pdfUrl: true,
    verified: true, verifiedAt: true, verifiedByName: true,
    rejectedAt: true, rejectedByName: true, rejectionNote: true,
    rejectionReason: { select: { label: true } },
    itineraries: {
        where: { OR: [{ hotelPending: true }, { hotelFilledAt: { not: null } }] as Prisma.custom_itinerariesWhereInput[] },
        select: { day: true, hotelPending: true, hotelRejectedAt: true, hotelRejectionNote: true, hotelFilledAt: true },
    },
} as const;

/** Rolls up a package's per-day hotel-request fields (see CUSTOM_PACKAGE_SELECT's
 * itineraries) into the one status/note/days a badge actually renders. */
function deriveHotelRequestStatus(itineraries: {
    day: number; hotelPending: boolean; hotelRejectedAt: Date | null;
    hotelRejectionNote: string | null; hotelFilledAt: Date | null;
}[]): Pick<SentPackageInfo, "hotelRequestStatus" | "hotelRequestNote" | "hotelRequestDays"> {
    const rejected = itineraries.filter((it) => it.hotelPending && it.hotelRejectedAt);
    if (rejected.length > 0) {
        return {
            hotelRequestStatus: "rejected",
            hotelRequestNote: rejected[0].hotelRejectionNote,
            hotelRequestDays: rejected.map((it) => it.day),
        };
    }
    const pending = itineraries.filter((it) => it.hotelPending);
    if (pending.length > 0) {
        return { hotelRequestStatus: "pending", hotelRequestNote: null, hotelRequestDays: pending.map((it) => it.day) };
    }
    const filled = itineraries.filter((it) => it.hotelFilledAt);
    if (filled.length > 0) {
        return { hotelRequestStatus: "filled", hotelRequestNote: null, hotelRequestDays: filled.map((it) => it.day) };
    }
    return { hotelRequestStatus: null, hotelRequestNote: null, hotelRequestDays: [] };
}

/** Flattens one CUSTOM_PACKAGE_SELECT result into the shape SentPackageInfo's
 * consumers (badges, the drawer) expect — rejectionReason.label pulled up to
 * rejectionReasonLabel, itineraries rolled up via deriveHotelRequestStatus.
 * Shared by every reader of custom_packages so the drawer (getSalesQueryById)
 * and the table (getSalesQueries) never drift into showing different data
 * for the same package. */
export function mapCustomPackage(cp: any): SentPackageInfo {
    return {
        ...cp,
        rejectionReasonLabel: cp.rejectionReason?.label ?? null,
        ...deriveHotelRequestStatus(cp.itineraries ?? []),
    };
}

/** Returns only queries assigned to the currently logged-in sales exec */
export async function getSalesQueries(): Promise<SalesQueryRow[]> {
    const { teamMemberId } = await getCurrentActor();

    const queries = await db.package_queries.findMany({
        where:   teamMemberId ? { assignedTo: teamMemberId } : {},
        include: {
            rejection_reasons: { select: { id: true, label: true } },
            _count:            { select: { queryFollowUps: true, notes: true } },
            custom_packages:   { select: CUSTOM_PACKAGE_SELECT, orderBy: { createdAt: "desc" } },
        },
        orderBy: { assignedAt: "desc" },
    }) as any[];

    return queries.map((q) => ({
        ...q,
        rejectionReason:  q.rejection_reasons ?? null,
        totalLeadQueries: 1,
        customPackages:   (q.custom_packages ?? []).map(mapCustomPackage),
    })) as SalesQueryRow[];
}

export async function getSalesQueryById(id: string) {
    const { teamMemberId } = await getCurrentActor();

    return db.package_queries.findUnique({
        where: { id },
        include: {
            queryFollowUps: {
                where:   teamMemberId ? { createdById: teamMemberId } : {},
                orderBy: { createdAt: "asc" },
            },
            notes:            { orderBy: { createdAt: "asc" } },
            timeline:         { orderBy: { createdAt: "asc" } },
            _count:           { select: { queryFollowUps: true, notes: true } },
            custom_packages:  { select: CUSTOM_PACKAGE_SELECT, orderBy: { createdAt: "desc" } },
        },
    });
}

export async function getMyFollowUpForQuery(packageQueryId: string): Promise<FollowUp | null> {
    const { teamMemberId } = await getCurrentActor();
    if (!teamMemberId) return null;

    return db.queryFollowUp.findFirst({
        where: { packageQueryId, createdById: teamMemberId },
    }) as Promise<FollowUp | null>;
}

export async function getMyFollowUps(packageQueryId?: string) {
    const { teamMemberId } = await getCurrentActor();
    if (!teamMemberId) return [];

    return db.queryFollowUp.findMany({
        where: {
            createdById: teamMemberId,
            ...(packageQueryId ? { packageQueryId } : {}),
        },
        orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
        include: {
            packageQuery: {
                select: {
                    id: true, name: true, phone: true, email: true,
                    destination: true, packageName: true, status: true,
                },
            },
        },
    });
}

// ── Follow-up — upsert (one per exec per query) ───────────────────────────────

const followUpSchema = z.object({
    note:       z.string().max(2000, "Note too long").optional(),
    followUpAt: z.string().optional(),
});

export async function addFollowUp(packageQueryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = followUpSchema.safeParse({
        note:       formData.get("note"),
        followUpAt: formData.get("followUpAt") || undefined,
    });

    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        const existing = teamMemberId
            ? await db.queryFollowUp.findFirst({
                where:  { packageQueryId, createdById: teamMemberId },
                select: { id: true },
            })
            : null;

        if (existing) {
            await db.queryFollowUp.update({
                where: { id: existing.id },
                data: {
                    note:       parsed.data.note ?? "",
                    followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
                },
            });
        } else {
            await db.queryFollowUp.create({
                data: {
                    packageQueryId,
                    note:          parsed.data.note ?? "",
                    followUpAt:    parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
                    createdById:   teamMemberId,
                    createdByName: teamMemberName,
                },
            });
        }

        if (parsed.data.followUpAt) {
            await db.package_queries.update({
                where: { id: packageQueryId },
                data:  { nextFollowUpAt: new Date(parsed.data.followUpAt) },
            });
        }

        // Move the query into FOLLOW_UP so the team can see it's being worked at a
        // glance — but never downgrade a query that's already further along the
        // funnel (e.g. package already sent, payment started, closed).
        const currentQuery = await db.package_queries.findUnique({
            where:  { id: packageQueryId },
            select: { status: true },
        });

        const terminalOrLaterStatuses = [
            "PACKAGE_SENT", "CLIENT_ACCEPTED", "CLIENT_DECLINED",
            "PAYMENT_INITIATED", "CONVERTED", "CLOSED",
        ];
        if (currentQuery && !terminalOrLaterStatuses.includes(currentQuery.status)) {
            await db.package_queries.update({
                where: { id: packageQueryId },
                data:  { status: "FOLLOW_UP" },
            });
        }

        await logTimeline(
            packageQueryId,
            existing ? `📞 Follow-up updated` : `📞 Follow-up logged`,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: existing ? "Follow-up updated" : "Follow-up added" };
    } catch (err) {
        console.error("addFollowUp error:", err);
        return { success: false, message: "Failed to save follow-up" };
    }
}

// ── Delete follow-up ──────────────────────────────────────────────────────────

export async function deleteFollowUp(followUpId: string): Promise<ActionResult> {
    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        const followUp = await db.queryFollowUp.findUnique({
            where:  { id: followUpId },
            select: { id: true, packageQueryId: true, createdById: true },
        });

        if (!followUp) return { success: false, message: "Follow-up not found" };
        if (followUp.createdById !== teamMemberId) return { success: false, message: "You can only delete your own follow-ups" };

        await db.queryFollowUp.delete({ where: { id: followUpId } });

        await db.package_queries.update({
            where: { id: followUp.packageQueryId },
            data:  { nextFollowUpAt: null },
        });

        await logTimeline(followUp.packageQueryId, `🗑️ Follow-up removed`, teamMemberId ?? undefined, teamMemberName ?? undefined);

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Follow-up removed" };
    } catch (err) {
        console.error("deleteFollowUp error:", err);
        return { success: false, message: "Failed to delete follow-up" };
    }
}

// ── Close query ───────────────────────────────────────────────────────────────

const closeQuerySchema = z.object({
    closeReasonId:    z.string().min(1, "Please select a reason"),
    closeReasonOther: z.string().optional(),
});

export async function closeSalesQuery(packageQueryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = closeQuerySchema.safeParse({
        closeReasonId:    formData.get("closeReasonId"),
        closeReasonOther: formData.get("closeReasonOther") || undefined,
    });

    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();
        const isConverted = parsed.data.closeReasonId === "CONVERTED";

        await db.package_queries.update({
            where: { id: packageQueryId },
            data: {
                status:           isConverted ? "CONVERTED" : "CLOSED",
                closeReasonId:    parsed.data.closeReasonId,
                closeReasonOther: parsed.data.closeReasonOther ?? null,
                closedAt:         new Date(),
                closedBy:         teamMemberId ?? null,
            },
        });

        const closeReasonLabel = (await _getCloseReasons()).find(r => r.id === parsed.data.closeReasonId)?.label
            ?? parsed.data.closeReasonId;
        const closeTimelineMsg = `❌ Closed — ${closeReasonLabel}` +
            (parsed.data.closeReasonOther ? `: "${parsed.data.closeReasonOther}"` : "");

        await logTimeline(
            packageQueryId,
            isConverted ? `✅ Converted — Booking Confirmed` : closeTimelineMsg,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
        );

        let convertedMessage = "Marked as Converted!";
        if (isConverted) {
            const bookingResult = await tryCreateBookingFromConvertedQuery(packageQueryId, teamMemberId, teamMemberName);
            convertedMessage = bookingResult.created
                ? `Marked as Converted! Booking ${bookingResult.bookingNumber} created — pending ops review.`
                : `Marked as Converted! Booking couldn't be auto-created (${bookingResult.reason}) — create it manually via Package Bookings.`;
        }

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: isConverted ? convertedMessage : "Closed successfully" };
    } catch (err) {
        console.error("closeSalesQuery error:", err);
        return { success: false, message: "Failed to close query" };
    }
}

// ── Reopen ────────────────────────────────────────────────────────────────────

export async function reopenSalesQuery(packageQueryId: string): Promise<ActionResult> {
    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        await db.package_queries.update({
            where: { id: packageQueryId },
            data: {
                status:           "IN_PROGRESS",
                closeReasonId:    null,
                closeReasonOther: null,
                closedAt:         null,
                closedBy:         null,
            },
        });

        await logTimeline(packageQueryId, `🔄 Query Reopened`, teamMemberId ?? undefined, teamMemberName ?? undefined);

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Reopened" };
    } catch (err) {
        console.error("reopenSalesQuery error:", err);
        return { success: false, message: "Failed to reopen" };
    }
}

// ── Package requirements ──────────────────────────────────────────────────────

const packageRequirementsSchema = z.object({
    travellers: z.object({
        leadName:       z.string().min(1),
        adults:         z.number().min(1),
        children:       z.number().min(0),
        infants:        z.number().min(0),
        members:        z.array(z.object({
            type: z.enum(["ADULT", "CHILD", "INFANT"]),
            name: z.string(),
            age:  z.number().min(0).max(120),
        })).optional(),
        tripType:       z.string().optional(),
        tripTypeCustom: z.string().optional(),
        specialDemands: z.string().optional(),
    }),
    journey: z.object({
        departurePoints: z.array(z.string()),
        pickupPoints:   z.array(z.string()),
        dateType:       z.enum(["FIXED", "FLEXIBLE"]),
        travelDate:     z.string().optional(),
        flexibleFrom:   z.string().optional(),
        flexibleTo:     z.string().optional(),
        noOfDays:       z.number().min(1),
        noOfNights:     z.number().min(0),
        destinations:   z.array(z.string()),
        specialDemands: z.string().optional(),
    }),
    stay: z.object({
        types:          z.array(z.string()),
        mealTypes:      z.array(z.string()),
        customMeal:     z.string().optional(),
        specialDemands: z.string().optional(),
    }),
    transport: z.object({
        required:       z.boolean(),
        cabTypes:       z.array(z.string()),
        includeFlights: z.boolean(),
        includeTrain:   z.boolean(),
        specialDemands: z.string().optional(),
    }),
    activities: z.object({
        selected:       z.array(z.string()),
        custom:         z.array(z.string()),
        specialDemands: z.string().optional(),
    }),
    budget: z.object({
        type:           z.enum(["PER_PERSON", "TOTAL"]),
        min:            z.number().optional(),
        max:            z.number().optional(),
        currency:       z.literal("INR"),
        specialDemands: z.string().optional(),
    }),
});

export async function savePackageRequirements(
    packageQueryId: string,
    requirements: PackageRequirements,
): Promise<ActionResult> {
    const parsed = packageRequirementsSchema.safeParse(requirements);

    if (!parsed.success) {
        return { success: false, message: "Invalid requirements data", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        const currentQuery = await db.package_queries.findUnique({
            where:  { id: packageQueryId },
            select: { status: true },
        });

        const terminalStatuses = ["PACKAGE_SENT", "CLIENT_ACCEPTED", "CLIENT_DECLINED", "PAYMENT_INITIATED", "CONVERTED", "CLOSED"];
        const shouldSetInProgress = !terminalStatuses.includes(currentQuery?.status ?? "");

        await db.package_queries.update({
            where: { id: packageQueryId },
            data: {
                requirements: parsed.data as Prisma.InputJsonValue,
                // The "Lead / Primary Traveller Name" field on this form is
                // seeded from (and edits) the same identity as the query's
                // own `name` column — without writing it back here, a name
                // typed/corrected on this form only ever lands in the
                // requirements JSON blob, so every other screen (query
                // tables, package builder, PDFs) keeps showing the old
                // top-level name.
                name:         parsed.data.travellers.leadName.trim(),
                groupSize:    parsed.data.travellers.adults + parsed.data.travellers.children,
                destination:  parsed.data.journey.destinations[0] ?? null,
                travelDate:   parsed.data.journey.travelDate ? new Date(parsed.data.journey.travelDate) : null,
                ...(shouldSetInProgress ? { status: "IN_PROGRESS" as const } : {}),
            },
        });

        await logTimeline(
            packageQueryId,
            `📋 Package requirements updated`,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
            {
                destinations: parsed.data.journey.destinations,
                pax:          parsed.data.travellers.adults + parsed.data.travellers.children + parsed.data.travellers.infants,
                budget:       parsed.data.budget,
            },
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Package requirements saved" };
    } catch (err: unknown) {
        console.error("savePackageRequirements error:", err);
        if (err instanceof Error) return { success: false, message: err.message || "Something went wrong" };
        return { success: false, message: "Unexpected error occurred" };
    }
}