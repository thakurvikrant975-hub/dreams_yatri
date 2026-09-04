"use server";

// (marketing)/queries/actions.ts
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { z } from "zod";
import { Prisma, QuerySource as QuerySourceEnum } from "@/app/generated/prisma";
import { actionError } from "@/app/lib/action-error";
import { getBoolSetting, setBoolSetting, SETTINGS_KEYS } from "@/app/lib/system-settings";
import { autoAssignLead, ACTIVE_PIPELINE_STATUSES } from "@/app/lib/queries/auto-assign";

// Normalizes a name to Title Case regardless of how it was typed/pasted in
// ("MAYANK SHARMA", "mayank sharma", "mayank Sharma" all become "Mayank
// Sharma") — enforced here server-side (not just in the Add dialog's
// onChange) so every entry path (Add, Edit, future callers) stays
// consistent no matter how the client submitted it.
function toTitleCase(s: string): string {
    return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// ── Types ─────────────────────────────────────────────────────────────────────
import { phoneKey, PHONE_KEY_SQL } from "@/app/lib/phone";
import { istDayBounds } from "@/app/lib/ist-window";

export type ActionResult<T = void> =
    | { success: true; data: T; message: string }
    | { success: false; data?: never; message: string; errors?: Record<string, string[]> };

export type QueryStatus =
    | "SUBMITTED"
    | "IN_PROGRESS"
    | "FOLLOW_UP"
    | "VERIFIED"
    | "REJECTED"
    | "ASSIGNED"
    | "PACKAGE_SENT"
    | "CLIENT_ACCEPTED"
    | "CLIENT_DECLINED"
    | "PAYMENT_INITIATED"
    | "CONVERTED"
    | "CLOSED";

// Derived from the Prisma enum's own keys (not hand-duplicated) so this can
// never drift again — a hand-written copy of this list is exactly what
// caused the "Meta" source option to fail validation (see manualQuerySchema
// below). Declared as its own local type alias rather than `export type {
// QuerySource }` — that re-export shape broke the build ("Export QuerySource
// doesn't exist in target module"), since this file has "use server" and the
// name QuerySourceEnum is also bound to a real runtime value in this module,
// which stopped Next's build from treating a same-named re-export as erased.
export type QuerySource = keyof typeof QuerySourceEnum;

export type CallOutcome =
    | "RECEIVED"
    | "NOT_RECEIVED"
    | "INVALID_NUMBER"
    | "REJECTED"
    | "BUSY"
    | "VOICEMAIL"
    | "CALL_BACK_LATER";

export type TravellerMember = {
    type: "ADULT" | "CHILD" | "INFANT";
    name: string;
    age: number;
};

export type PackageRequirements = {
    travellers: {
        leadName: string;
        adults: number;
        children: number;
        infants: number;
        members?: TravellerMember[];
        /** Purpose of the trip — one of TRIP_TYPES' values (Packagedetailsdialog.tsx),
         * or "OTHER" with the free-text reason in tripTypeCustom. */
        tripType?: string;
        tripTypeCustom?: string;
        specialDemands?: string;
    };
    journey: {
        /** One or more cities the group is travelling from — a family
         * travelling together may fly out from different home cities. */
        departurePoints: string[];
        /** One or more specific pickup spots (airport, hotel, landmark) —
         * distinct from departurePoints, which is the origin city itself. */
        pickupPoints: string[];
        dateType: "FIXED" | "FLEXIBLE";
        travelDate?: string;
        flexibleFrom?: string;
        flexibleTo?: string;
        noOfDays: number;
        noOfNights: number;
        destinations: string[];
        specialDemands?: string;
    };
    stay: {
        types: string[];
        mealTypes: string[];
        customMeal?: string;
        specialDemands?: string;
    };
    transport: {
        required: boolean;
        cabTypes: string[];
        includeFlights: boolean;
        includeTrain: boolean;
        specialDemands?: string;
    };
    activities: {
        selected: string[];
        custom: string[];
        specialDemands?: string;
    };
    budget: {
        type: "PER_PERSON" | "TOTAL";
        min?: number;
        max?: number;
        currency: "INR";
        specialDemands?: string;
    };
};

/**
 * Canonical query shape used by BOTH marketing and sales tables.
 * PackageQueryType is an alias used in the sales route.
 */
export type PackageQuery = {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    countryCode: string;
    whatsapp: string | null;
    whatsappSameAsPhone: boolean;
    leadProfileId: string | null;
    message: string | null;
    packageName: string | null;
    destination: string | null;
    travelDate: Date | null;
    groupSize: number | null;
    source: QuerySource;
    status: QueryStatus;
    verified: boolean;
    verifiedAt: Date | null;
    verifiedBy: string | null;
    rejectionReasonId: string | null;
    rejectionNote: string | null;
    callAttempts: number;
    lastAttemptAt: Date | null;
    nextFollowUpAt: Date | null;
    assignedTo: string | null;
    assignedToName: string | null;
    assignedAt: Date | null;
    closedAt: Date | null;
    closedBy: string | null;
    closeReasonId: string | null;
    closeReasonOther: string | null;
    requirements: PackageRequirements | null;
    packageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    rejectionReason: { id: string; label: string } | null;
    _count: { notes: number; queryFollowUps: number };
    totalLeadQueries: number;
    /** When the exec's package actually reached the client (custom_packages.sentAt)
     * — null until sent. A query can have more than one package (see
     * duplicateCustomPackageIntoDraft); this is whichever one was sent first. */
    packageSentAt: Date | null;
};

// Aliases for backwards compatibility
export type PackageQueryType = PackageQuery;
export type package_queries = PackageQuery;

export type RejectionReason = {
    id: string;
    label: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { queries: number };
};

export type CloseReason = {
    id: string;
    label: string;
    requiresNote: boolean;
};

export type FollowUp = {
    id: string;
    packageQueryId: string;
    note: string;
    followUpAt: Date | null;
    createdAt: Date;
    createdById: string | null;
    createdByName: string | null;
};

// ── FIX: Extended SalesMember with richer stats ───────────────────────────────
export type SalesMember = {
    id: string;
    name: string;
    email: string;
    profilePicUrl:    string | null;  // ← add
    /** Queries in active pipeline (ASSIGNED / IN_PROGRESS / PACKAGE_SENT / CLIENT_ACCEPTED / CLIENT_DECLINED / PAYMENT_INITIATED) */
    activeQueries: number;
    /** All queries ever assigned to this member */
    totalQueries: number;
    /** Queries that ended as CONVERTED */
    convertedQueries: number;
    /** An outside agency we sell leads to rather than one of our own execs.
     * Assigned exactly the same way — the picker only needs to say which is
     * which, so a manager knows a lead is leaving the building. */
    isPartnerAgency: boolean;
};

export type DestinationOption = { id: number; name: string; slug: string };
export type PackageOption = { id: number; title: string; slug: string };

export type ManualQueryFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

export type RejectionReasonFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

// ── Shared helpers (also used by sales/actions.ts) ────────────────────────────

export async function logTimeline(
    queryId: string,
    event: string,
    actorId?: string,
    actorName?: string,
    meta?: Record<string, unknown>,
) {
    await db.queryTimeline.create({
        data: {
            queryId,
            event,
            actorId,
            actorName,
            meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
    });
}

export async function getCurrentActor() {
    const session = await dashboardAuth();
    const actor = session?.user;
    let teamMemberId: string | null = null;
    let teamMemberName: string | null = null;

    if (actor?.email) {
        const tm = await db.teamMember.findUnique({
            where: { email: actor.email },
            select: { id: true, name: true },
        });
        teamMemberId = tm?.id ?? null;
        teamMemberName = tm?.name ?? (actor as any).name ?? null;
    }

    return { actor, teamMemberId, teamMemberName };
}

// ── Shared READ (also used by sales/actions.ts) ───────────────────────────────

export async function getQueryById(id: string) {
    return db.package_queries.findUnique({
        where: { id },
        include: {
            rejection_reasons: true,
            queryFollowUps: { orderBy: { createdAt: "asc" } },
            notes: { orderBy: { createdAt: "asc" } },
            timeline: { orderBy: { createdAt: "asc" } },
            _count: { select: { queryFollowUps: true, notes: true } },
        },
    });
}

export async function getCloseReasons(): Promise<CloseReason[]> {
    return [
        { id: "NO_PACKAGE_NEEDED", label: "No Package Needed", requiresNote: false },
        { id: "COST_TOO_HIGH", label: "Our Cost Is Too High", requiresNote: false },
        { id: "NOT_SATISFIED", label: "Not Satisfied", requiresNote: false },
        { id: "BOOKED_ELSEWHERE", label: "Booked Elsewhere", requiresNote: false },
        { id: "TRAVEL_CANCELLED", label: "Travel Cancelled", requiresNote: false },
        { id: "UNRESPONSIVE", label: "Unresponsive", requiresNote: false },
        { id: "CONVERTED", label: "Booking Confirmed ✓", requiresNote: false },
        { id: "OTHER", label: "Other", requiresNote: true },
    ];
}

export async function getRejectionReasons(): Promise<RejectionReason[]> {
    const data = await db.rejectionReason.findMany({
        where: { isActive: true },
        include: {
            _count: { select: { package_queries: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return data.map((item) => ({
        ...item,
        _count: {
            queries: item._count.package_queries,
        },
    }));
}

/** Active + inactive — the reject dialogs only ever need getRejectionReasons
 * (active-only, above); this is for the /dashboard/queries/rejection-reasons
 * management page, where a retired reason still needs to be visible (to
 * re-enable it, or just to see it was used historically). */
export async function getAllRejectionReasons(): Promise<RejectionReason[]> {
    const data = await db.rejectionReason.findMany({
        include: {
            _count: { select: { package_queries: true, custom_packages: true } },
        },
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    return data.map((item) => ({
        ...item,
        _count: {
            // Combined usage across both rejection surfaces this reason can
            // be attached to (query rejection and package-pricing rejection)
            // — the management page just needs "is this reason in use at
            // all", not a breakdown by which flow used it.
            queries: item._count.package_queries + item._count.custom_packages,
        },
    }));
}

// ── FIX: getSalesMembers — active-only, correct counts, richer stats ──────────
/** `salesTeamId` narrows the roster to one SalesTeam — used by a Team
 * Leader's reassign picker so they only ever see their own team, not the
 * whole sales floor. Omitted, this is the original unscoped list. */
export async function getSalesMembers(salesTeamId?: string): Promise<SalesMember[]> {
    // FIX 1: Only active sales team members
    /*
     * Our own executives, plus any partner agency.
     *
     * An agency is handed leads through the same column and the same action,
     * so it belongs in the same picker — a lead manager choosing where a lead
     * goes should see every destination in one list. Scoping to a team is a
     * Team Leader's own roster, which never includes an agency.
     */
    const members = await db.teamMember.findMany({
        where: {
            OR: [
                { teamRole: { name: { equals: "Sales Executive", mode: "insensitive" } } },
                ...(salesTeamId ? [] : [{ teamRole: { isPartnerAgency: true } }]),
            ],
            isActive: true, // ← was missing; was returning inactive members too
            ...(salesTeamId ? { salesTeamId } : {}),
        },
        select: {
            id: true, name: true, email: true, profilePicUrl: true,
            teamRole: { select: { isPartnerAgency: true } },
        },
        orderBy: { name: "asc" },
    });

    if (members.length === 0) return [];

    const ids = members.map((m) => m.id);

    // FIX 2: Active query count = queries currently in the sales pipeline
    // (ASSIGNED, IN_PROGRESS, PACKAGE_SENT, CLIENT_ACCEPTED, CLIENT_DECLINED, PAYMENT_INITIATED)
    // Previously only counted SUBMITTED / IN_PROGRESS which was wrong.
    const [activeCounts, totalCounts, convertedCounts] = await Promise.all([
        db.package_queries.groupBy({
            by: ["assignedTo"],
            where: {
                assignedTo: { in: ids },
                status: {
                    in: [
                        "ASSIGNED",
                        "IN_PROGRESS",
                        "FOLLOW_UP",
                        "PACKAGE_SENT",
                        "CLIENT_ACCEPTED",
                        "CLIENT_DECLINED",
                        "PAYMENT_INITIATED",
                    ],
                },
            },
            _count: { id: true },
        }),
        // FIX 3: Total queries ever assigned — for conversion rate display
        db.package_queries.groupBy({
            by: ["assignedTo"],
            where: { assignedTo: { in: ids } },
            _count: { id: true },
        }),
        // FIX 3: Converted queries count
        db.package_queries.groupBy({
            by: ["assignedTo"],
            where: { assignedTo: { in: ids }, status: "CONVERTED" },
            _count: { id: true },
        }),
    ]);

    const activeMap    = Object.fromEntries(activeCounts.map((c)    => [c.assignedTo!, c._count.id]));
    const totalMap     = Object.fromEntries(totalCounts.map((c)     => [c.assignedTo!, c._count.id]));
    const convertedMap = Object.fromEntries(convertedCounts.map((c) => [c.assignedTo!, c._count.id]));

    return members.map(({ teamRole, ...m }) => ({
        ...m,
        activeQueries:    activeMap[m.id]    ?? 0,
        totalQueries:     totalMap[m.id]     ?? 0,
        convertedQueries: convertedMap[m.id] ?? 0,
        isPartnerAgency:  teamRole?.isPartnerAgency ?? false,
    }));
}

export async function getDestinationsForQuery(): Promise<DestinationOption[]> {
    return db.destinations.findMany({
        where: { is_active: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
    });
}

export async function getPackagesByDestination(destinationId: number): Promise<PackageOption[]> {
    const id = Number(destinationId);
    if (!id || isNaN(id)) return [];
    return db.packages.findMany({
        where: { destination_id: id, is_active: true },
        select: { id: true, title: true, slug: true },
        orderBy: { title: "asc" },
    });
}

/**
 * Shared assign — used by both marketing (hand-off) and sales (reassign).
 * setStatus=true  → flips to ASSIGNED (or back to VERIFIED if unassigned)
 * setStatus=false → leaves status untouched (sales reassign mid-funnel)
 */
export async function assignQuery(
    queryId: string,
    memberId: string | null,
    setStatus = true,
): Promise<ActionResult> {
    try {
        const { teamMemberId: actorId, teamMemberName: actorName } = await getCurrentActor();

        let assigneeName: string | null = null;
        if (memberId) {
            const member = await db.teamMember.findUnique({
                where: { id: memberId },
                select: { id: true, name: true },
            });
            if (!member) return { success: false, message: "Invalid team member selected" };
            assigneeName = member.name;
        }

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                assignedTo: memberId ?? null,
                assignedAt: memberId ? new Date() : null,
                assignedToName: assigneeName,
                ...(setStatus
                    ? { status: memberId ? ("ASSIGNED" as const) : ("VERIFIED" as const) }
                    : {}),
            },
        });

        await db.queryTimeline.create({
            data: {
                queryId,
                event: memberId
                    ? `Assigned to ${assigneeName ?? "team member"}`
                    : `Assignment removed`,
                actorId: actorId ?? null,
                actorName: actorName ?? null,
                meta: { assignedTo: memberId, assigneeName } as Prisma.InputJsonValue,
            },
        });

        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/sales-query");
        return {
            success: true,
            data: undefined,
            message: memberId ? `Assigned to ${assigneeName}` : "Assignment removed",
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[assignQuery] FAILED:", msg);
        return { success: false, message: `Failed to assign query: ${msg}` };
    }
}

// ── Auto-assign toggle ─────────────────────────────────────────────────────────

export async function getAutoAssignSetting(): Promise<boolean> {
    return getBoolSetting(SETTINGS_KEYS.autoAssignQueries, true);
}

export async function setAutoAssignSetting(enabled: boolean): Promise<ActionResult<{ enabled: boolean }>> {
    try {
        const { teamMemberId } = await getCurrentActor();
        await setBoolSetting(SETTINGS_KEYS.autoAssignQueries, enabled, teamMemberId);
        revalidatePath("/dashboard/queries");
        return {
            success: true,
            data: { enabled },
            message: enabled ? "Auto-assign turned on" : "Auto-assign turned off — assign leads manually",
        };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Auto-assign per-member limits ───────────────────────────────────────────
// See app/lib/queries/auto-assign.ts for how these are actually consumed.

export type AutoAssignMemberSetting = {
    id:          string;
    name:        string;
    email:       string;
    active:      boolean;
    min:         number | null;
    max:         number | null;
    /** Current active-pipeline lead count — same figure the round robin
     * itself ranks by, shown for context next to the min/max inputs so an
     * admin can see at a glance who's already at/near their limit. */
    activeCount: number;
};

export async function getAutoAssignMemberSettings(): Promise<AutoAssignMemberSetting[]> {
    const members = await db.teamMember.findMany({
        where: { teamRole: { name: { equals: "Sales Executive", mode: "insensitive" } } },
        select: {
            id: true, name: true, email: true, isActive: true,
            autoAssignActive: true, autoAssignMin: true, autoAssignMax: true,
        },
        orderBy: { name: "asc" },
    });
    if (members.length === 0) return [];

    const counts = await db.package_queries.groupBy({
        by: ["assignedTo"],
        where: { assignedTo: { in: members.map((m) => m.id) }, status: { in: [...ACTIVE_PIPELINE_STATUSES] } },
        _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.assignedTo as string, c._count.id]));

    return members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        active: m.autoAssignActive,
        min: m.autoAssignMin,
        max: m.autoAssignMax,
        activeCount: countMap.get(m.id) ?? 0,
    }));
}

/**
 * A partner agency's share of the day's leads, as the lead manager sets it.
 *
 * Deliberately a different shape from a sales executive's min/max: those bound
 * how much work one person carries at a time, while an agency is bought from
 * — so many a day, spread out, and only the leads we choose to sell.
 */
export type PartnerAgencySetting = {
    id: string;
    name: string;
    email: string;
    /** In the rotation at all (the same per-member switch execs have). */
    active: boolean;
    dailyCap: number;
    gapMin: number;
    gapMax: number;
    maxGroupSize: number | null;
    blockedDestinations: string[];
    blockedSources: QuerySource[];
    /** Handed over so far today (IST) — the figure dailyCap is measured
     * against, shown so a manager can see where the day stands. */
    givenToday: number;
};

export async function getPartnerAgencySettings(): Promise<PartnerAgencySetting[]> {
    const members = await db.teamMember.findMany({
        where: { teamRole: { isPartnerAgency: true }, isActive: true },
        select: {
            id: true, name: true, email: true, autoAssignActive: true,
            partnerLeadRule: true,
        },
        orderBy: { name: "asc" },
    });
    if (members.length === 0) return [];

    const { start, end } = istDayBounds();
    const given = await db.package_queries.groupBy({
        by: ["assignedTo"],
        where: {
            assignedTo: { in: members.map((m) => m.id) },
            deletedAt: null,
            assignedAt: { gte: start, lte: end },
        },
        _count: { id: true },
    });
    const givenMap = new Map(given.map((g) => [g.assignedTo as string, g._count.id]));

    return members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        active: m.autoAssignActive,
        // An agency with no rule row yet reads as "set up but selling
        // nothing", which is the safe thing for it to mean.
        dailyCap: m.partnerLeadRule?.dailyCap ?? 0,
        gapMin: m.partnerLeadRule?.gapMin ?? 7,
        gapMax: m.partnerLeadRule?.gapMax ?? 14,
        maxGroupSize: m.partnerLeadRule?.maxGroupSize ?? null,
        blockedDestinations: m.partnerLeadRule?.blockedDestinations ?? [],
        blockedSources: m.partnerLeadRule?.blockedSources ?? [],
        givenToday: givenMap.get(m.id) ?? 0,
    }));
}

export async function updatePartnerAgencySetting(
    memberId: string,
    input: {
        active: boolean;
        dailyCap: number;
        gapMin: number;
        gapMax: number;
        maxGroupSize: number | null;
        blockedDestinations: string[];
        blockedSources: QuerySource[];
    },
): Promise<ActionResult> {
    try {
        if (input.dailyCap < 0) return { success: false, message: "Leads per day can't be negative" };
        if (input.gapMin < 1 || input.gapMax < 1) return { success: false, message: "The gap has to be at least 1 lead" };
        if (input.gapMin > input.gapMax) return { success: false, message: "The smallest gap can't be bigger than the largest" };
        if (input.maxGroupSize != null && input.maxGroupSize < 1) {
            return { success: false, message: "Group size limit has to be at least 1" };
        }

        const member = await db.teamMember.findUnique({
            where: { id: memberId },
            select: { teamRole: { select: { isPartnerAgency: true } } },
        });
        if (!member?.teamRole?.isPartnerAgency) {
            return { success: false, message: "That member is not a partner agency" };
        }

        const data = {
            dailyCap: input.dailyCap,
            gapMin: input.gapMin,
            gapMax: input.gapMax,
            maxGroupSize: input.maxGroupSize,
            blockedDestinations: input.blockedDestinations.map((d) => d.trim()).filter(Boolean),
            blockedSources: input.blockedSources,
        };
        await db.$transaction([
            db.teamMember.update({ where: { id: memberId }, data: { autoAssignActive: input.active } }),
            db.partnerLeadRule.upsert({
                where: { memberId },
                update: data,
                create: { memberId, ...data },
            }),
        ]);
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Saved" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

export async function updateAutoAssignMemberSetting(
    memberId: string,
    input: { active: boolean; min: number | null; max: number | null },
): Promise<ActionResult> {
    try {
        if (input.min != null && input.min < 0) return { success: false, message: "Min can't be negative" };
        if (input.max != null && input.max < 0) return { success: false, message: "Max can't be negative" };
        if (input.min != null && input.max != null && input.min > input.max) {
            return { success: false, message: "Min can't be greater than max" };
        }
        await db.teamMember.update({
            where: { id: memberId },
            data: { autoAssignActive: input.active, autoAssignMin: input.min, autoAssignMax: input.max },
        });
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Saved" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Marketing READ ────────────────────────────────────────────────────────────

export async function getQueries(): Promise<PackageQuery[]> {
    const queries = await db.package_queries.findMany({
        where: { deletedAt: null },
        include: {
            rejection_reasons: { select: { id: true, label: true } },
            _count: { select: { notes: true, queryFollowUps: true } },
            lead_profiles: {
                select: {
                    _count: { select: { package_queries: true } },
                },
            },
            custom_packages: { select: { sentAt: true } },
        },
        orderBy: { createdAt: "desc" },
    }) as any[];

    return queries.map((q) => ({
        ...q,
        rejectionReason: q.rejection_reasons ?? null,
        totalLeadQueries: q.lead_profiles?._count?.package_queries ?? 1,
        packageSentAt: q.custom_packages?.find((p: { sentAt: Date | null }) => p.sentAt)?.sentAt ?? null,
    })) as PackageQuery[];
}

// ── Status transitions ────────────────────────────────────────────────────────

export async function markInProgress(queryId: string): Promise<ActionResult> {
    try {
        const { actor } = await getCurrentActor();

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                status: "IN_PROGRESS",
                callAttempts: { increment: 1 },
                lastAttemptAt: new Date(),
            },
        });

        await logTimeline(queryId, "📞 Marked as In Progress — call attempted", actor?.id, actor?.name ?? undefined);
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Query moved to In Progress" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

export async function verifyQuery(queryId: string): Promise<ActionResult> {
    try {
        const { actor } = await getCurrentActor();

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                status: "VERIFIED",
                verified: true,
                verifiedAt: new Date(),
                verifiedBy: actor?.id ?? null,
            },
        });

        await logTimeline(queryId, "✅ Lead Verified — confirmed interest", actor?.id, actor?.name ?? undefined);
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Query verified successfully" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Reject ────────────────────────────────────────────────────────────────────

const rejectSchema = z.object({
    rejectionReasonId: z.string().min(1, "Select a rejection reason"),
    rejectionNote: z.string().max(500).optional(),
});

export async function rejectQuery(queryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = rejectSchema.safeParse({
        rejectionReasonId: formData.get("rejectionReasonId"),
        rejectionNote: formData.get("rejectionNote") || undefined,
    });

    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { actor } = await getCurrentActor();
        const reason = await db.rejectionReason.findUnique({ where: { id: parsed.data.rejectionReasonId } });

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                status: "REJECTED",
                verified: false,
                rejectionReasonId: parsed.data.rejectionReasonId,
                rejectionNote: parsed.data.rejectionNote ?? null,
            },
        });

        await logTimeline(
            queryId,
            `Query Rejected — ${reason?.label ?? "Unknown reason"}${parsed.data.rejectionNote ? ` · Note: ${parsed.data.rejectionNote}` : ""}`,
            actor?.id,
            actor?.name ?? undefined,
            { reason: reason?.label, note: parsed.data.rejectionNote },
        );

        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Query rejected" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Log call attempt ──────────────────────────────────────────────────────────

export async function logCallAttempt(
    queryId: string,
    nextFollowUpAt?: Date,
    outcome?: CallOutcome,
    response?: string,
): Promise<ActionResult> {
    const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
        RECEIVED: "Call Received",
        NOT_RECEIVED: "Not Received",
        INVALID_NUMBER: "Invalid Number",
        REJECTED: "Call Rejected by Customer",
        BUSY: "Line Busy",
        VOICEMAIL: "Went to Voicemail",
        CALL_BACK_LATER: "Customer Asked to Call Back Later",
    };

    try {
        const { actor } = await getCurrentActor();

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                callAttempts: { increment: 1 },
                lastAttemptAt: new Date(),
                nextFollowUpAt: nextFollowUpAt ?? null,
                status: "IN_PROGRESS",
            },
        });

        const updated = await db.package_queries.findUnique({ where: { id: queryId }, select: { callAttempts: true } });
        const outcomeLabel = outcome ? CALL_OUTCOME_LABELS[outcome] : "Call attempted";
        const parts = [`📞 Call Attempt #${updated?.callAttempts ?? "?"} — ${outcomeLabel}`];
        if (response) parts.push(`Note: ${response}`);

        await logTimeline(queryId, parts.join(" · "), actor?.id, actor?.name ?? undefined, {
            outcome, response, nextFollowUp: nextFollowUpAt?.toISOString(),
        });

        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Call attempt logged" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

const noteSchema = z.object({
    content: z.string().min(1, "Note cannot be empty").max(1000),
});

export async function addNote(queryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = noteSchema.safeParse({ content: formData.get("content") });
    if (!parsed.success) {
        return { success: false, message: "Note is required", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { actor } = await getCurrentActor();

        await db.queryNote.create({
            data: { queryId, authorId: actor?.id ?? "system", content: parsed.data.content },
        });

        await logTimeline(queryId, `📝 Note added`, actor?.id, actor?.name ?? undefined, {
            preview: parsed.data.content.slice(0, 80),
        });

        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Note added" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Rejection reasons CRUD ────────────────────────────────────────────────────

const reasonSchema = z.object({
    label: z.string().min(1, "Label is required").max(100),
    description: z.string().max(300).optional(),
});

export async function createRejectionReason(
    _prev: RejectionReasonFormState,
    formData: FormData,
): Promise<RejectionReasonFormState> {
    const parsed = reasonSchema.safeParse({
        label: formData.get("label"),
        description: formData.get("description") || undefined,
    });
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }
    try {
        // sortOrder has no DB default beyond 0 — without this, every
        // newly-created reason would sort before all the seeded ones
        // (10, 20, 30…) instead of after them.
        const last = await db.rejectionReason.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
        await db.rejectionReason.create({ data: { ...parsed.data, sortOrder: (last?.sortOrder ?? 0) + 10 } });
        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/queries/rejection-reasons");
        return { success: true, message: "Rejection reason created" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

export async function updateRejectionReason(
    id: string,
    _prev: RejectionReasonFormState,
    formData: FormData,
): Promise<RejectionReasonFormState> {
    const parsed = reasonSchema.safeParse({
        label: formData.get("label"),
        description: formData.get("description") || undefined,
    });
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }
    try {
        await db.rejectionReason.update({ where: { id }, data: parsed.data });
        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/queries/rejection-reasons");
        return { success: true, message: "Rejection reason updated" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

export async function deleteRejectionReason(id: string): Promise<ActionResult> {
    try {
        const reason = await db.rejectionReason.findUnique({
            where: { id },
            select: { isSystem: true, _count: { select: { package_queries: true, custom_packages: true } } },
        });
        if (reason?.isSystem) return { success: false, message: "System reasons cannot be deleted" };
        const usageCount = (reason?._count.package_queries ?? 0) + (reason?._count.custom_packages ?? 0);
        if (usageCount > 0) {
            return { success: false, message: `This reason is used on ${usageCount} past ${usageCount === 1 ? "record" : "records"} — disable it instead of deleting so that history stays intact.` };
        }
        await db.rejectionReason.delete({ where: { id } });
        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/queries/rejection-reasons");
        return { success: true, data: undefined, message: "Reason deleted" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

export async function toggleRejectionReason(id: string, isActive: boolean): Promise<ActionResult> {
    try {
        await db.rejectionReason.update({ where: { id }, data: { isActive } });
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: `Reason ${isActive ? "enabled" : "disabled"}` };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Create / update query (manual entry) ──────────────────────────────────────

const manualQuerySchema = z.object({
    // Optional — a phone-call lead who hasn't given their name yet still
    // needs to be logged and followed up on; "name required" used to force
    // staff to type a placeholder by hand or lose the enquiry entirely.
    name: z.string().max(100).optional(),
    phone: z.string().min(6, "Valid phone number required").max(20),
    countryCode: z.string().default("IN"),
    // Hidden input sends the literal string "false" when the exec flips the
    // "different WhatsApp number" switch on — anything else (missing field,
    // "true") means "same as phone".
    whatsappSameAsPhone: z.string().optional().transform((v) => v !== "false"),
    whatsapp: z.string().max(20).optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    destination: z.string().optional(),
    packageName: z.string().optional(),
    groupSize: z.coerce.number().int().min(1).max(500).optional(),
    travelDate: z.string().optional(),
    message: z.string().max(2000).optional(),
    source: z.nativeEnum(QuerySourceEnum).default("PHONE_CALL"),
}).refine(
    (data) => data.whatsappSameAsPhone || (data.whatsapp?.trim().length ?? 0) >= 6,
    { message: "Enter a valid WhatsApp number", path: ["whatsapp"] },
);

export async function createManualQuery(
    _prev: ManualQueryFormState,
    formData: FormData,
): Promise<ManualQueryFormState> {
    const parsed = manualQuerySchema.safeParse({
        name: formData.get("name"),
        phone: formData.get("phone"),
        countryCode: (formData.get("countryCode") as string) || "IN",
        whatsappSameAsPhone: formData.get("whatsappSameAsPhone") || undefined,
        whatsapp: formData.get("whatsapp") || undefined,
        email: formData.get("email") || undefined,
        destination: formData.get("destination") as string,
        packageName: formData.get("packageName") || undefined,
        groupSize: formData.get("groupSize") || undefined,
        travelDate: formData.get("travelDate") || undefined,
        message: formData.get("message") || undefined,
        source: formData.get("source") || "PHONE_CALL",
    });

    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { actor } = await getCurrentActor();
        // Strip any spaces the exec typed/pasted between digit groups (e.g.
        // "98765 43210") — PhoneInput already submits a clean value, but this
        // is the last line of defense so a stray space can never land in the
        // stored phone number regardless of how it got here.
        const cleanPhone = parsed.data.phone.replace(/\s+/g, "");
        const normalizedPhone = cleanPhone.replace(/[\-().+]/g, "");
        const rawName = toTitleCase(parsed.data.name?.trim() ?? "") || undefined;
        const displayName = rawName || "Unknown Caller";

        // Matched on the number's identity, not the string it was typed as —
        // otherwise "+91 98765 43210" sails past a query added minutes ago as
        // "9876543210", and both land on the board.
        const key = phoneKey(cleanPhone);
        const recentDuplicate = await db.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM package_queries
              WHERE ${PHONE_KEY_SQL} = $1 AND "createdAt" >= $2 AND "deletedAt" IS NULL
              LIMIT 1;`,
            key, new Date(Date.now() - 1000 * 60 * 5),
        );
        if (recentDuplicate.length > 0) {
            return { success: false, message: "A query from this number was submitted in the last 5 minutes." };
        }

        // Found by the number's key so one person keeps one profile whichever
        // spelling arrives. Leaving `name` out of the update entirely when
        // none was given this time keeps whatever real name is already on
        // file instead of overwriting it with the placeholder.
        const existingProfile = await db.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM lead_profiles WHERE ${PHONE_KEY_SQL} = $1 LIMIT 1;`, key,
        );
        const profile = existingProfile.length > 0
            ? await db.leadProfile.update({
                where: { id: existingProfile[0].id },
                data: { name: rawName || undefined, email: parsed.data.email || undefined, lastSeenAt: new Date(), totalQueries: { increment: 1 } },
            })
            : await db.leadProfile.create({
                data: { phone: normalizedPhone, name: displayName, email: parsed.data.email || null },
            });

        // Same last-line-of-defense stripping as cleanPhone above — PhoneInput
        // already submits a clean value, but this is what actually lands in
        // the column.
        const cleanWhatsapp = parsed.data.whatsapp?.replace(/\s+/g, "") || null;

        const query = await db.package_queries.create({
            data: {
                name: displayName,
                phone: cleanPhone,
                whatsapp: parsed.data.whatsappSameAsPhone ? null : cleanWhatsapp,
                whatsappSameAsPhone: parsed.data.whatsappSameAsPhone,
                email: parsed.data.email || null,
                destination: parsed.data.destination || null,
                packageName: parsed.data.packageName || null,
                groupSize: parsed.data.groupSize ?? null,
                travelDate: parsed.data.travelDate ? new Date(parsed.data.travelDate) : null,
                message: parsed.data.message || null,
                source: parsed.data.source,
                status: "VERIFIED",
                verified: false,
                leadProfileId: profile.id,
            },
        });

        await logTimeline(query.id, `Query manually created by ${actor?.name ?? "team member"}`, actor?.id, actor?.name ?? undefined, { source: parsed.data.source });

        await autoAssignLead(query.id);

        revalidatePath("/dashboard/queries");
        return { success: true, message: `Query for ${displayName} saved successfully` };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

const updateQuerySchema = z.object({
    name: z.string().max(100).optional(),
    phone: z.string().min(6, "Valid phone required").max(20),
    countryCode: z.string().default("IN"),
    whatsappSameAsPhone: z.string().optional().transform((v) => v !== "false"),
    whatsapp: z.string().max(20).optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    destination: z.string().optional(),
    packageName: z.string().optional(),
    groupSize: z.coerce.number().int().min(1).max(500).optional(),
    travelDate: z.string().optional(),
    message: z.string().max(2000).optional(),
    source: z.nativeEnum(QuerySourceEnum),
}).refine(
    (data) => data.whatsappSameAsPhone || (data.whatsapp?.trim().length ?? 0) >= 6,
    { message: "Enter a valid WhatsApp number", path: ["whatsapp"] },
);

export async function updateQuery(queryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = updateQuerySchema.safeParse({
        name: formData.get("name"),
        phone: formData.get("phone"),
        countryCode: (formData.get("countryCode") as string) || "IN",
        whatsappSameAsPhone: formData.get("whatsappSameAsPhone") || undefined,
        whatsapp: formData.get("whatsapp") || undefined,
        email: formData.get("email") || undefined,
        destination: formData.get("destination") as string,
        packageName: formData.get("packageName") || undefined,
        groupSize: formData.get("groupSize") || undefined,
        travelDate: formData.get("travelDate") || undefined,
        message: formData.get("message") || undefined,
        source: formData.get("source"),
    });

    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const { actor } = await getCurrentActor();
        const cleanPhone = parsed.data.phone.replace(/\s+/g, "");
        const normalizedPhone = cleanPhone.replace(/[\-().+]/g, "");
        const rawName = toTitleCase(parsed.data.name?.trim() ?? "") || undefined;
        const displayName = rawName || "Unknown Caller";

        await db.leadProfile.upsert({
            where: { phone: normalizedPhone },
            update: { name: rawName || undefined, email: parsed.data.email || undefined, lastSeenAt: new Date() },
            create: { phone: normalizedPhone, name: displayName, email: parsed.data.email || null },
        });

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                name: displayName,
                phone: cleanPhone,
                countryCode: parsed.data.countryCode,
                whatsapp: parsed.data.whatsappSameAsPhone ? null : (parsed.data.whatsapp || null),
                whatsappSameAsPhone: parsed.data.whatsappSameAsPhone,
                email: parsed.data.email || null,
                destination: parsed.data.destination || null,
                packageName: parsed.data.packageName || null,
                groupSize: parsed.data.groupSize ?? null,
                travelDate: parsed.data.travelDate ? new Date(parsed.data.travelDate) : null,
                message: parsed.data.message || null,
                source: parsed.data.source,
            },
        });

        // Timeline logging is an audit trail, not core to the update — the query
        // record above already saved successfully, so a logging failure here
        // must not make the caller think the whole edit failed.
        await logTimeline(queryId, `✏️ Query details updated`, actor?.id, actor?.name ?? undefined)
            .catch((e) => console.error("[updateQuery] logTimeline failed:", e));

        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Query updated successfully" };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

// ── Duplicate-phone lookup (Add Query dialog) ──────────────────────────────────
// Looked up via LeadProfile (always stored normalized, regardless of how the
// underlying package_queries.phone was formatted at the time it was saved) so
// this reliably catches duplicates even against queries created before phone
// numbers were normalized on save.

export type ExistingQueryMatch = {
    name:           string;
    status:         QueryStatus;
    assignedToName: string | null;
    createdAt:      Date;
};

export async function checkExistingQueryByPhone(phone: string): Promise<ExistingQueryMatch | null> {
    const normalized = phone.replace(/[\s\-().+]/g, "");
    if (normalized.length < 6) return null;

    /*
     * Straight at the leads rather than via the profile, matched on the
     * number's identity.
     *
     * Going through LeadProfile.phone meant an exact-string lookup against
     * one spelling, so a lead saved as "+91 98765 43210" was invisible to a
     * check on "9876543210" — and a duplicate hint that misses reads as
     * "this one is new", which is the answer that causes the damage.
     */
    const rows = await db.$queryRawUnsafe<{
        name: string; status: QueryStatus; assignedToName: string | null; createdAt: Date;
    }[]>(
        `SELECT name, status, "assignedToName", "createdAt"
           FROM package_queries
          WHERE ${PHONE_KEY_SQL} = $1 AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 1;`,
        phoneKey(normalized),
    );

    const latest = rows[0];
    if (!latest) return null;

    return {
        name:           latest.name,
        status:         latest.status as QueryStatus,
        assignedToName: latest.assignedToName,
        createdAt:      latest.createdAt,
    };
}

// ── Delete query ────────────────────────────────────────────────────────────────

export async function deleteQuery(queryId: string): Promise<ActionResult> {
    try {
        const query = await db.package_queries.findUnique({
            where: { id: queryId },
            select: {
                name: true,
                status: true,
                booking: { select: { id: true } },
                _count: { select: { custom_packages: true } },
            },
        });
        if (!query) return { success: false, message: "Query not found — it may already be deleted." };

        // A real booking always blocks deletion — CONVERTED means money
        // actually changed hands, never safe to hide regardless of status.
        if (query.booking) {
            return { success: false, message: "Can't delete — this query has a booking linked to it." };
        }
        // A built package alone doesn't block deletion once the query is
        // CLOSED (client declined/went elsewhere/etc.) — that package was
        // never going anywhere either, and hiding is non-destructive (it
        // stays in the DB, so the package's own link keeps resolving fine).
        // Still blocked for any non-terminal status, so an active/pending
        // package can't be accidentally hidden out of the pipeline.
        if (query._count.custom_packages > 0 && query.status !== "CLOSED") {
            const count = query._count.custom_packages;
            return {
                success: false,
                message: `Can't delete — this query has ${count} package${count > 1 ? "s" : ""} linked to it. Close the query first if you'd like to delete it.`,
            };
        }

        const { actor } = await getCurrentActor();
        // Soft delete — hides the row from the queries list without actually
        // removing it, so nothing is ever permanently lost.
        await db.package_queries.update({
            where: { id: queryId },
            data: { deletedAt: new Date(), deletedBy: actor?.id ?? null },
        });

        console.log(`[deleteQuery] "${query.name}" (${queryId}) deleted by ${actor?.name ?? actor?.email ?? "unknown"}`);

        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: `Query for ${query.name} deleted` };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}