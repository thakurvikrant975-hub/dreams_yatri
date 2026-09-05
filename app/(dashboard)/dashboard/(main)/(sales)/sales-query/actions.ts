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
import { getLeaderScope } from "@/app/lib/sales-teams/leader-scope";

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
    updateQueryMessage as _updateQueryMessage,
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
export async function updateQueryMessage(queryId: string, message: string): Promise<ActionResult> {
    return _updateQueryMessage(queryId, message);
}

/** Whether the logged-in actor leads a SalesTeam — drives the "My Queries" vs
 * "Team Queries" view on the sales-query page. */
export async function isSalesTeamLeader(): Promise<boolean> {
    const scope = await getLeaderScope();
    return !!scope?.ledTeamId;
}

/** The Team Leader's own roster — feeds the reassign picker on "Team
 * Queries" so a leader can only hand a query to someone on their team, not
 * the whole sales floor. Empty for anyone who doesn't lead a team. */
export async function getMyTeamMembers(): Promise<SalesMember[]> {
    const scope = await getLeaderScope();
    if (!scope?.ledTeamId) return [];
    return _getSalesMembers(scope.ledTeamId);
}

/** Reassign a query to another member of the caller's own SalesTeam.
 *
 * A Team Leader oversees a specific team, not the whole sales floor — this
 * re-derives that scope server-side rather than trusting the memberId the
 * client sends, the same reasoning resolveWorkspaceCaps re-derives package
 * capabilities instead of trusting what the UI last showed. */
export async function reassignToTeamMember(queryId: string, memberId: string | null): Promise<ActionResult> {
    const scope = await getLeaderScope();
    if (!scope?.ledTeamId) return { success: false, message: "Only a team leader can reassign a query." };

    if (memberId) {
        const member = await db.teamMember.findUnique({
            where:  { id: memberId },
            select: { salesTeamId: true },
        });
        if (!member || member.salesTeamId !== scope.ledTeamId) {
            return { success: false, message: "That person isn't on your team." };
        }
    }

    return _assignQuery(queryId, memberId, false);
}

// ── Sales READ ────────────────────────────────────────────────────────────────

// SentPackageInfo/mapCustomPackage live in package-status.ts, not here — this
// file has "use server" at the top, and every export from a Server Actions
// module must be an async function, which a plain data-shaping helper isn't.
export type { SentPackageInfo } from "./package-status";
import { mapCustomPackage } from "./package-status";
import type { SentPackageInfo } from "./package-status";

// A query can now have more than one package built for it (e.g. two
// different budget options sent to the same client) — most recent first.
export type SalesQueryRow = PackageQuery & { customPackages: SentPackageInfo[]; callLogStatuses: CallLogStatus[] };

const CUSTOM_PACKAGE_SELECT = {
    id: true, title: true, status: true, createdAt: true, sentAt: true, readyAt: true,
    totalPrice: true, pricePerPerson: true, pdfUrl: true, builtByName: true,
    coverImage: true, destination: true, totalDays: true, totalNights: true,
    verified: true, verifiedAt: true, verifiedByName: true,
    rejectedAt: true, rejectedByName: true, rejectionNote: true,
    rejectionReason: { select: { label: true } },
    // Route legs for the "Copy Existing" card in CreatePackageDialog — same
    // source buildSnapshotFromPackage reads for the library snapshot.
    stops: {
        orderBy: { sortOrder: "asc" } as Prisma.custom_package_stopsOrderByWithRelationInput,
        select: { name: true, nights: true },
    },
    itineraries: {
        where: { OR: [{ hotelPending: true }, { hotelFilledAt: { not: null } }] as Prisma.custom_itinerariesWhereInput[] },
        select: { day: true, hotelPending: true, hotelRejectedAt: true, hotelRejectionNote: true, hotelFilledAt: true },
    },
} as const;

/** Returns queries assigned to the currently logged-in sales exec — or, for a
 * Team Leader, every query assigned to anyone on their SalesTeam (themselves
 * included, since SalesTeam.members always includes the leader).
 *
 * `from`/`to` (YYYY-MM-DD) scope by `assignedAt`, not `createdAt` — this page
 * is a rep's/leader's worklist of queries assigned to them (see the "Assigned"
 * column and the default `orderBy: assignedAt` below), not a report on when a
 * lead was first captured. A lead can sit in the marketing queue for days
 * before being handed to sales; filtering by `createdAt` made it vanish from
 * "today" even though it was genuinely assigned today. (getLeadManagerAnalytics
 * is a different, creation-dated report and deliberately keeps `createdAt`.)
 * Omit both for the "All Time" view. */
export async function getSalesQueries(from?: string, to?: string): Promise<SalesQueryRow[]> {
    const { teamMemberId } = await getCurrentActor();
    const scope = await getLeaderScope();

    const teamMemberIds = scope?.ledTeamId
        ? (await db.teamMember.findMany({
            where: { salesTeamId: scope.ledTeamId },
            select: { id: true },
        })).map((m) => m.id)
        : null;

    const queries = await db.package_queries.findMany({
        where: {
            deletedAt: null,
            ...(teamMemberIds
                ? { assignedTo: { in: teamMemberIds } }
                : teamMemberId ? { assignedTo: teamMemberId } : {}),
            ...(from && to
                ? { assignedAt: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) } }
                : {}),
        },
        include: {
            rejection_reasons: { select: { id: true, label: true } },
            _count:            { select: { queryFollowUps: true, notes: true } },
            custom_packages:   { select: CUSTOM_PACKAGE_SELECT, orderBy: { createdAt: "desc" } },
        },
        orderBy: { assignedAt: "desc" },
    }) as any[];

    // PackageTemplate has no FK/relation to custom_packages (sourcePackageId
    // is an informal string link — see the model comment), so the "saved to
    // library" status can't ride along in the include above. One batched
    // lookup across every package on this page instead of a per-row query.
    const allPackageIds = queries.flatMap((q) => (q.custom_packages ?? []).map((cp: { id: string }) => cp.id));
    const templates = allPackageIds.length > 0
        ? await db.packageTemplate.findMany({
            where: { sourcePackageId: { in: allPackageIds } },
            select: { sourcePackageId: true, status: true },
        })
        : [];
    const libraryStatusByPackageId = new Map(templates.map((t) => [t.sourcePackageId, t.status]));

    // Call logs live as QueryTimeline rows (meta.kind === "CALL_LOG", see
    // logCall below) rather than their own table — no dedicated relation to
    // put in the `include` above, so this is a second batched lookup, same
    // reasoning as the library-status one just above. Each call's own
    // status (not just a count) — the Lead column renders one colored dot
    // per call, oldest first, so `asc` here is what puts them in call order.
    const queryIds = queries.map((q) => q.id);
    const callLogRows = queryIds.length > 0
        ? await db.queryTimeline.findMany({
            where:   { queryId: { in: queryIds }, meta: { path: ["kind"], equals: "CALL_LOG" } },
            orderBy: { createdAt: "asc" },
            select:  { queryId: true, meta: true },
        })
        : [];
    const callLogStatusesByQueryId = new Map<string, CallLogStatus[]>();
    for (const row of callLogRows) {
        const status = (row.meta as { status?: CallLogStatus } | null)?.status ?? "CONNECTED";
        const arr = callLogStatusesByQueryId.get(row.queryId) ?? [];
        arr.push(status);
        callLogStatusesByQueryId.set(row.queryId, arr);
    }

    return queries.map((q) => ({
        ...q,
        rejectionReason:   q.rejection_reasons ?? null,
        totalLeadQueries:  1,
        customPackages:    (q.custom_packages ?? []).map((cp: { id: string }) =>
            mapCustomPackage(cp, libraryStatusByPackageId.get(cp.id) ?? null)),
        callLogStatuses:   callLogStatusesByQueryId.get(q.id) ?? [],
    })) as SalesQueryRow[];
}

export async function getSalesQueryById(id: string) {
    const { teamMemberId } = await getCurrentActor();
    const scope = await getLeaderScope();

    // A Team Leader can see every follow-up logged on the query (not just
    // their own), same as they can see every team member's queries.
    const query = await db.package_queries.findUnique({
        where: { id },
        include: {
            queryFollowUps: {
                where:   scope?.ledTeamId ? {} : teamMemberId ? { createdById: teamMemberId } : {},
                orderBy: { createdAt: "asc" },
            },
            notes:            { orderBy: { createdAt: "asc" } },
            timeline:         { orderBy: { createdAt: "asc" } },
            _count:           { select: { queryFollowUps: true, notes: true } },
            custom_packages:  { select: CUSTOM_PACKAGE_SELECT, orderBy: { createdAt: "desc" } },
        },
    });
    if (!query) return null;

    // QueryNote only stores authorId — resolve it to a display name the same
    // way hotels/cab-pricing/permits/etc. batch-resolve actorId → name, so
    // the sales exec sees who left each note instead of a bare id.
    const authorIds = Array.from(new Set(query.notes.map((n) => n.authorId).filter((aid) => aid !== "system")));
    const authors = authorIds.length > 0
        ? await db.teamMember.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
        : [];
    const nameById = new Map(authors.map((a) => [a.id, a.name]));

    return {
        ...query,
        notes: query.notes.map((n) => ({
            ...n,
            authorName: n.authorId === "system" ? "System" : (nameById.get(n.authorId) ?? null),
        })),
    };
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

// ── Call log ──────────────────────────────────────────────────────────────────

export type CallLogStatus = "CONNECTED" | "NOT_PICKED" | "DECLINED";

// Not exported — a "use server" module can only export async functions, and
// this is a plain object. CallLogDialog.tsx keeps its own copy for display.
const CALL_LOG_STATUS_LABELS: Record<CallLogStatus, string> = {
    CONNECTED:  "Connected",
    NOT_PICKED: "Not Picked",
    DECLINED:   "Declined",
};

const callLogSchema = z.object({
    status: z.enum(["CONNECTED", "NOT_PICKED", "DECLINED"]),
    note:   z.string().max(1000, "Note too long").optional(),
});

/** Logs a call attempt against an already-assigned query — status + an
 * optional note, on the timeline both the exec and their team leader already
 * read (QueryTimelineSheet). Deliberately separate from the marketing
 * queue's logCallAttempt, which also bumps callAttempts/status/
 * nextFollowUpAt: those describe a lead still being worked into the
 * pipeline, not "I called about a query already assigned to me", and
 * reusing that action here would silently reset them on every call logged. */
export async function logCall(packageQueryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = callLogSchema.safeParse({
        status: formData.get("status"),
        note:   formData.get("note") || undefined,
    });

    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();
        const label = CALL_LOG_STATUS_LABELS[parsed.data.status];
        const event = `📞 Call Logged — ${label}` + (parsed.data.note ? ` · Note: ${parsed.data.note}` : "");

        await logTimeline(packageQueryId, event, teamMemberId ?? undefined, teamMemberName ?? undefined, {
            kind:   "CALL_LOG",
            status: parsed.data.status,
            note:   parsed.data.note ?? null,
        });

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Call logged" };
    } catch (err) {
        console.error("logCall error:", err);
        return { success: false, message: "Failed to log call" };
    }
}

export type CallLogEntry = {
    id:        string;
    status:    CallLogStatus;
    note:      string | null;
    actorName: string | null;
    createdAt: Date;
};

/** This query's own call history — newest first. Feeds CallLogDialog, which
 * shows it above the "log a new call" form so opening the dialog doubles as
 * reviewing what's already been tried before dialing again. */
export async function getCallLogsForQuery(packageQueryId: string): Promise<CallLogEntry[]> {
    const rows = await db.queryTimeline.findMany({
        where:   { queryId: packageQueryId, meta: { path: ["kind"], equals: "CALL_LOG" } },
        orderBy: { createdAt: "desc" },
        select:  { id: true, meta: true, actorName: true, createdAt: true },
    });

    return rows.map((r) => {
        const meta = r.meta as { status?: CallLogStatus; note?: string | null } | null;
        return {
            id:        r.id,
            status:    meta?.status ?? "CONNECTED",
            note:      meta?.note ?? null,
            actorName: r.actorName,
            createdAt: r.createdAt,
        };
    });
}