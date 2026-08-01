"use server";

// (marketing)/queries/actions.ts
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { z } from "zod";
import { Prisma, QuerySource as QuerySourceEnum } from "@/app/generated/prisma";
import { actionError } from "@/app/lib/action-error";
import { getBoolSetting, setBoolSetting, SETTINGS_KEYS } from "@/app/lib/system-settings";
import { autoAssignLead } from "@/app/lib/queries/auto-assign";

// ── Types ─────────────────────────────────────────────────────────────────────
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
export async function getSalesMembers(): Promise<SalesMember[]> {
    // FIX 1: Only active sales team members
    const members = await db.teamMember.findMany({
        where: {
            teamRole: { name: { equals: "Sales Executive", mode: "insensitive" } },
            isActive: true, // ← was missing; was returning inactive members too
        },
        select: { id: true, name: true, email: true, profilePicUrl: true },
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

    return members.map((m) => ({
        ...m,
        activeQueries:    activeMap[m.id]    ?? 0,
        totalQueries:     totalMap[m.id]     ?? 0,
        convertedQueries: convertedMap[m.id] ?? 0,
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

// ── Marketing READ ────────────────────────────────────────────────────────────

export async function getQueries(): Promise<PackageQuery[]> {
    const queries = await db.package_queries.findMany({
        include: {
            rejection_reasons: { select: { id: true, label: true } },
            _count: { select: { notes: true, queryFollowUps: true } },
            lead_profiles: {
                select: {
                    _count: { select: { package_queries: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    }) as any[];

    return queries.map((q) => ({
        ...q,
        rejectionReason: q.rejection_reasons ?? null,
        totalLeadQueries: q.lead_profiles?._count?.package_queries ?? 1,
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
    name: z.string().min(1, "Name is required"),
    phone: z.string().min(6, "Valid phone number required").max(20),
    countryCode: z.string().default("IN"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    destination: z.string().min(1, "Destination is required"),
    packageName: z.string().optional(),
    groupSize: z.coerce.number().int().min(1).max(500).optional(),
    travelDate: z.string().optional(),
    message: z.string().max(2000).optional(),
    source: z.nativeEnum(QuerySourceEnum).default("PHONE_CALL"),
});

export async function createManualQuery(
    _prev: ManualQueryFormState,
    formData: FormData,
): Promise<ManualQueryFormState> {
    const parsed = manualQuerySchema.safeParse({
        name: formData.get("name"),
        phone: formData.get("phone"),
        countryCode: (formData.get("countryCode") as string) || "IN",
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
        const normalizedPhone = parsed.data.phone.replace(/[\s\-().+]/g, "");

        const recentDuplicate = await db.package_queries.findFirst({
            where: { phone: parsed.data.phone, createdAt: { gte: new Date(Date.now() - 1000 * 60 * 5) } },
        });
        if (recentDuplicate) {
            return { success: false, message: "A query from this number was submitted in the last 5 minutes." };
        }

        const profile = await db.leadProfile.upsert({
            where: { phone: normalizedPhone },
            update: { name: parsed.data.name, email: parsed.data.email || undefined, lastSeenAt: new Date(), totalQueries: { increment: 1 } },
            create: { phone: normalizedPhone, name: parsed.data.name, email: parsed.data.email || null },
        });

        const query = await db.package_queries.create({
            data: {
                name: parsed.data.name,
                phone: parsed.data.phone,
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
        return { success: true, message: `Query for ${parsed.data.name} saved successfully` };
    } catch (e) {
        console.error(e);
        return actionError(e);
    }
}

const updateQuerySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    phone: z.string().min(6, "Valid phone required").max(20),
    countryCode: z.string().default("IN"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    destination: z.string().min(1, "Destination is required"),
    packageName: z.string().optional(),
    groupSize: z.coerce.number().int().min(1).max(500).optional(),
    travelDate: z.string().optional(),
    message: z.string().max(2000).optional(),
    source: z.nativeEnum(QuerySourceEnum),
});

export async function updateQuery(queryId: string, formData: FormData): Promise<ActionResult> {
    const parsed = updateQuerySchema.safeParse({
        name: formData.get("name"),
        phone: formData.get("phone"),
        countryCode: (formData.get("countryCode") as string) || "IN",
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
        const normalizedPhone = parsed.data.phone.replace(/[\s\-().+]/g, "");

        await db.leadProfile.upsert({
            where: { phone: normalizedPhone },
            update: { name: parsed.data.name, email: parsed.data.email || undefined, lastSeenAt: new Date() },
            create: { phone: normalizedPhone, name: parsed.data.name, email: parsed.data.email || null },
        });

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                name: parsed.data.name,
                phone: parsed.data.phone,
                countryCode: parsed.data.countryCode,
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