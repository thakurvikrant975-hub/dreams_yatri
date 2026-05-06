// /(sales)/sales-query/action.ts

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";

export type ActionResult<T = void> =
    | { success: true; data: T; message: string }
    | { success: false; data?: never; message: string; errors?: Record<string, string[]> };

export type PackageQueryType = {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    countryCode: string;
    packageName: string | null;
    destination: string | null;
    travelDate: Date | null;
    groupSize: number | null;
    message: string | null;
    source: string;
    status: string;
    assignedTo: string | null;
    assignedAt: Date | null;
    closedAt: Date | null;
    closedBy: string | null;
    closeReasonId: string | null;
    closeReasonOther: string | null;
    nextFollowUpAt: Date | null;
    requirements: PackageRequirements | null;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        queryFollowUps: number;
        notes: number;
    };
};

export type SalesQuery = PackageQueryType;

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

export type PackageRequirements = {
    travellers: {
        leadName: string;
        adults: number;
        children: number;
        infants: number;
        specialDemands?: string;
    };
    journey: {
        startingPoint: string;
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

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const followUpSchema = z.object({
    note: z.string().min(1, "Note is required").max(2000, "Note too long"),
    followUpAt: z.string().optional(),
});

const closeQuerySchema = z.object({
    closeReasonId: z.string().min(1, "Please select a reason"),
    closeReasonOther: z.string().optional(),
});

const packageRequirementsSchema = z.object({
    travellers: z.object({
        leadName: z.string().min(1),
        adults: z.number().min(1),
        children: z.number().min(0),
        infants: z.number().min(0),
        specialDemands: z.string().optional(),
    }),
    journey: z.object({
        startingPoint: z.string(),
        dateType: z.enum(["FIXED", "FLEXIBLE"]),
        travelDate: z.string().optional(),
        flexibleFrom: z.string().optional(),
        flexibleTo: z.string().optional(),
        noOfDays: z.number().min(1),
        noOfNights: z.number().min(0),
        destinations: z.array(z.string()),
        specialDemands: z.string().optional(),
    }),
    stay: z.object({
        types: z.array(z.string()),
        mealTypes: z.array(z.string()),
        customMeal: z.string().optional(),
        specialDemands: z.string().optional(),
    }),
    transport: z.object({
        required: z.boolean(),
        cabTypes: z.array(z.string()),
        includeFlights: z.boolean(),
        specialDemands: z.string().optional(),
    }),
    activities: z.object({
        selected: z.array(z.string()),
        custom: z.array(z.string()),
        specialDemands: z.string().optional(),
    }),
    budget: z.object({
        type: z.enum(["PER_PERSON", "TOTAL"]),
        min: z.number().optional(),
        max: z.number().optional(),
        currency: z.literal("INR"),
        specialDemands: z.string().optional(),
    }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logTimeline(
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

async function getCurrentActor() {
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

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getSalesQueries() {
    const session = await dashboardAuth();
    let userId: string | null = null;

    if (session?.user?.email) {
        const teamMember = await db.teamMember.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = teamMember?.id ?? null;
    }

    return db.package_queries.findMany({
        where: userId ? { assignedTo: userId } : {},
        include: {
            _count: { select: { queryFollowUps: true, notes: true } },
        },
        orderBy: { assignedAt: "desc" },
    });
}

export async function getSalesQueryById(id: string) {
    const { teamMemberId } = await getCurrentActor();

    return db.package_queries.findUnique({
        where: { id },
        include: {
            // Only this exec's follow-ups
            queryFollowUps: {
                where: teamMemberId ? { createdById: teamMemberId } : {},
                orderBy: { createdAt: "asc" },
            },
            notes: { orderBy: { createdAt: "asc" } },
            timeline: { orderBy: { createdAt: "asc" } },
            _count: { select: { queryFollowUps: true, notes: true } },
        },
    });
}

// Returns the current exec's follow-up for a specific query (for pre-filling the dialog)
export async function getMyFollowUpForQuery(packageQueryId: string): Promise<FollowUp | null> {
    const { teamMemberId } = await getCurrentActor();
    if (!teamMemberId) return null;

    const fu = await db.queryFollowUp.findFirst({
        where: { packageQueryId, createdById: teamMemberId },
    });

    return fu as FollowUp | null;
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
                select: { id: true, name: true, destination: true, status: true },
            },
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

// ── FOLLOW-UP — upsert (one per exec per query) ───────────────────────────────

export async function addFollowUp(
    packageQueryId: string,
    formData: FormData,
): Promise<ActionResult> {
    const parsed = followUpSchema.safeParse({
        note: formData.get("note"),
        followUpAt: formData.get("followUpAt") || undefined,
    });

    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        const existing = teamMemberId
            ? await db.queryFollowUp.findFirst({
                where: { packageQueryId, createdById: teamMemberId },
                select: { id: true },
            })
            : null;

        if (existing) {
            await db.queryFollowUp.update({
                where: { id: existing.id },
                data: {
                    note: parsed.data.note,
                    followUpAt: parsed.data.followUpAt
                        ? new Date(parsed.data.followUpAt)
                        : null,
                },
            });
        } else {
            await db.queryFollowUp.create({
                data: {
                    packageQueryId,
                    note: parsed.data.note,
                    followUpAt: parsed.data.followUpAt
                        ? new Date(parsed.data.followUpAt)
                        : null,
                    createdById: teamMemberId,
                    createdByName: teamMemberName,
                },
            });
        }

        if (parsed.data.followUpAt) {
            await db.package_queries.update({
                where: { id: packageQueryId },
                data: { nextFollowUpAt: new Date(parsed.data.followUpAt) },
            });
        }

        // ASSIGNED → IN_PROGRESS when exec first engages
        const currentQuery = await db.package_queries.findUnique({
            where: { id: packageQueryId },
            select: { status: true },
        });
        if (currentQuery?.status === "ASSIGNED") {
            await db.package_queries.update({
                where: { id: packageQueryId },
                data: { status: "IN_PROGRESS" },
            });
        }

        await logTimeline(
            packageQueryId,
            existing ? `📞 Follow-up updated` : `📞 Follow-up logged`,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return {
            success: true,
            data: undefined,
            message: existing ? "Follow-up updated" : "Follow-up added",
        };
    } catch (err) {
        console.error("addFollowUp error:", err);
        return { success: false, message: "Failed to save follow-up" };
    }
}

// ── DELETE FOLLOW-UP ──────────────────────────────────────────────────────────

export async function deleteFollowUp(followUpId: string): Promise<ActionResult> {
    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        const followUp = await db.queryFollowUp.findUnique({
            where: { id: followUpId },
            select: { id: true, packageQueryId: true, createdById: true },
        });

        if (!followUp) {
            return { success: false, message: "Follow-up not found" };
        }

        // Only the creator can delete their own follow-up
        if (followUp.createdById !== teamMemberId) {
            return { success: false, message: "You can only delete your own follow-ups" };
        }

        await db.queryFollowUp.delete({ where: { id: followUpId } });

        // Clear nextFollowUpAt on the parent query since we removed the follow-up
        await db.package_queries.update({
            where: { id: followUp.packageQueryId },
            data: { nextFollowUpAt: null },
        });

        await logTimeline(
            followUp.packageQueryId,
            `🗑️ Follow-up removed`,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Follow-up removed" };
    } catch (err) {
        console.error("deleteFollowUp error:", err);
        return { success: false, message: "Failed to delete follow-up" };
    }
}

// ── CLOSE QUERY ───────────────────────────────────────────────────────────────

export async function closeSalesQuery(
    packageQueryId: string,
    formData: FormData,
): Promise<ActionResult> {
    const parsed = closeQuerySchema.safeParse({
        closeReasonId: formData.get("closeReasonId"),
        closeReasonOther: formData.get("closeReasonOther") || undefined,
    });

    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();
        const isConverted = parsed.data.closeReasonId === "CONVERTED";

        await db.package_queries.update({
            where: { id: packageQueryId },
            data: {
                status: isConverted ? "CONVERTED" : "CLOSED",
                closeReasonId: parsed.data.closeReasonId,
                closeReasonOther: parsed.data.closeReasonOther ?? null,
                closedAt: new Date(),
                closedBy: teamMemberId ?? null,
            },
        });

        await logTimeline(
            packageQueryId,
            isConverted
                ? `✅ Converted — Booking Confirmed`
                : `❌ Closed — ${parsed.data.closeReasonId}`,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return {
            success: true,
            data: undefined,
            message: isConverted ? "Marked as Converted!" : "Closed successfully",
        };
    } catch (err) {
        console.error("closeSalesQuery error:", err);
        return { success: false, message: "Failed to close query" };
    }
}

// ── REOPEN ────────────────────────────────────────────────────────────────────

export async function reopenSalesQuery(packageQueryId: string): Promise<ActionResult> {
    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        await db.package_queries.update({
            where: { id: packageQueryId },
            data: {
                status: "IN_PROGRESS",
                closeReasonId: null,
                closeReasonOther: null,
                closedAt: null,
                closedBy: null,
            },
        });

        await logTimeline(
            packageQueryId,
            `🔄 Query Reopened`,
            teamMemberId ?? undefined,
            teamMemberName ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Reopened" };
    } catch (err) {
        console.error("reopenSalesQuery error:", err);
        return { success: false, message: "Failed to reopen" };
    }
}

// ── PACKAGE REQUIREMENTS ──────────────────────────────────────────────────────

export async function savePackageRequirements(
    packageQueryId: string,
    requirements: PackageRequirements,
): Promise<ActionResult> {
    const parsed = packageRequirementsSchema.safeParse(requirements);

    if (!parsed.success) {
        return {
            success: false,
            message: "Invalid requirements data",
            errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
    }

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();

        const currentQuery = await db.package_queries.findUnique({
            where: { id: packageQueryId },
            select: { status: true },
        });

        // Always set IN_PROGRESS when requirements are filled/updated
        // (unless already further along the funnel)
        const terminalStatuses = ["PACKAGE_SENT", "CLIENT_ACCEPTED", "CLIENT_DECLINED", "PAYMENT_INITIATED", "CONVERTED", "CLOSED"];
        const shouldSetInProgress = !terminalStatuses.includes(currentQuery?.status ?? "");

        await db.package_queries.update({
            where: { id: packageQueryId },
            data: {
                requirements: parsed.data as Prisma.InputJsonValue,
                groupSize: parsed.data.travellers.adults + parsed.data.travellers.children,
                destination: parsed.data.journey.destinations[0] ?? null,
                travelDate: parsed.data.journey.travelDate
                    ? new Date(parsed.data.journey.travelDate)
                    : null,
                // Set IN_PROGRESS unless already further along
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
                pax: parsed.data.travellers.adults + parsed.data.travellers.children + parsed.data.travellers.infants,
                budget: parsed.data.budget,
            },
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Package requirements saved" };
    } catch (err: unknown) {
        console.error("savePackageRequirements error:", err);
        if (err instanceof Error) {
            return { success: false, message: err.message || "Something went wrong" };
        }
        return { success: false, message: "Unexpected error occurred" };
    }
}

// ── ASSIGN QUERY (marketing → sales exec) ─────────────────────────────────────

export async function assignQuery(
    queryId: string,
    memberId: string | null,
): Promise<ActionResult> {
    try {
        const session = await dashboardAuth();

        const actorMember = await db.teamMember.findUnique({
            where: { email: session?.user?.email ?? "" },
            select: { id: true, name: true },
        });

        let assigneeName: string | null = null;

        if (memberId) {
            const member = await db.teamMember.findUnique({
                where: { id: memberId },
                select: { id: true, name: true },
            });

            if (!member) {
                return { success: false, message: "Invalid team member selected" };
            }

            assigneeName = member.name;
        }

        await db.package_queries.update({
            where: { id: queryId },
            data: {
                assignedTo: memberId ?? null,
                assignedAt: memberId ? new Date() : null,
                assignedToName: assigneeName,
                // FIX: set ASSIGNED status when marketing hands off to sales exec
                ...(memberId
                    ? { status: "ASSIGNED" as const }
                    : { status: "VERIFIED" as const }  // revert to VERIFIED if unassigned
                ),
            },
        });

        await db.queryTimeline.create({
            data: {
                queryId,
                event: memberId
                    ? `👤 Assigned to ${assigneeName ?? "team member"}`
                    : `👤 Assignment removed`,
                actorId: actorMember?.id ?? null,
                actorName: actorMember?.name ?? null,
                meta: { assignedTo: memberId, assigneeName } as Prisma.InputJsonValue,
            },
        });

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