"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
    | { success: true; data: T; message: string }
    | { success: false; data?: never; message: string; errors?: Record<string, string[]> };

export type SalesQueryStatus = "ACTIVE" | "CLOSED";

export type SalesQuery = {
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
    status: SalesQueryStatus;
    assignedTo: string | null;
    assignedAt: Date | null;
    closeReasonId: string | null;
    closeReasonOther: string | null;
    closedAt: Date | null;
    closedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    closeReason: { id: string; label: string } | null;
    _count: { followUps: number; notes: number };
};

export type CloseReason = {
    id: string;
    label: string;
    requiresNote: boolean;
};

export type FollowUp = {
    id: string;
    salesQueryId: string;
    note: string;
    followUpAt: Date | null;
    createdAt: Date;
    createdBy: string | null;
    createdByName: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logSalesTimeline(
    salesQueryId: string,
    event: string,
    actorId?: string,
    actorName?: string,
    meta?: Record<string, unknown>,
) {
    await db.salesQueryTimeline.create({
        data: {
            salesQueryId,
            event,
            actorId,
            actorName,
            meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
    });
}

// ── READ ──────────────────────────────────────────────────────────────────────

/**
 * Returns all sales queries assigned to the current user.
 * Falls back to all queries if no session (dev convenience).
 */
export async function getSalesQueries(): Promise<SalesQuery[]> {
    const session = await dashboardAuth();
    const userId = session?.user?.id;

    return db.salesQuery.findMany({
        where: userId ? { assignedTo: userId } : undefined,
        include: {
            closeReason: { select: { id: true, label: true } },
            _count: { select: { followUps: true, notes: true } },
        },
        orderBy: { assignedAt: "desc" },
    }) as unknown as Promise<SalesQuery[]>;
}

export async function getSalesQueryById(id: string) {
    return db.salesQuery.findUnique({
        where: { id },
        include: {
            closeReason: true,
            followUps: { orderBy: { createdAt: "asc" } },
            notes: { orderBy: { createdAt: "asc" } },
            timeline: { orderBy: { createdAt: "asc" } },
        },
    });
}

/**
 * Hard-coded close reasons — swap for a DB lookup if you have a table.
 */
export async function getCloseReasons(): Promise<CloseReason[]> {
    // If you have a closeReasons table, replace with a DB query.
    return [
        { id: "NO_PACKAGE_NEEDED",      label: "No Package Needed",           requiresNote: false },
        { id: "COST_TOO_HIGH",          label: "Our Cost Is Too High",         requiresNote: false },
        { id: "NOT_SATISFIED",          label: "Not Satisfied with Package",   requiresNote: false },
        { id: "BOOKED_ELSEWHERE",       label: "Booked with Competitor",       requiresNote: false },
        { id: "TRAVEL_CANCELLED",       label: "Travel Cancelled / Postponed", requiresNote: false },
        { id: "UNRESPONSIVE",           label: "Lead Unresponsive",            requiresNote: false },
        { id: "OTHER",                  label: "Other",                        requiresNote: true  },
    ];
}

// ── FOLLOW-UP ─────────────────────────────────────────────────────────────────

const followUpSchema = z.object({
    note:        z.string().min(1, "Follow-up note is required").max(1000),
    followUpAt:  z.string().optional(),
});

export async function addFollowUp(
    salesQueryId: string,
    formData: FormData,
): Promise<ActionResult> {
    const parsed = followUpSchema.safeParse({
        note:       formData.get("note"),
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
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.salesQueryFollowUp.create({
            data: {
                salesQueryId,
                note:          parsed.data.note,
                followUpAt:    parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
                createdBy:     actor?.id ?? null,
                createdByName: actor?.name ?? null,
            },
        });

        // Update nextFollowUpAt on the parent query if a date was set
        if (parsed.data.followUpAt) {
            await db.salesQuery.update({
                where: { id: salesQueryId },
                data:  { nextFollowUpAt: new Date(parsed.data.followUpAt) },
            });
        }

        await logSalesTimeline(
            salesQueryId,
            `📞 Follow-up logged${parsed.data.followUpAt ? ` · Scheduled: ${new Date(parsed.data.followUpAt).toLocaleDateString()}` : ""}`,
            actor?.id,
            actor?.name ?? undefined,
            { note: parsed.data.note.slice(0, 80) },
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Follow-up added successfully" };
    } catch {
        return { success: false, message: "Failed to add follow-up" };
    }
}

// ── CLOSE QUERY ───────────────────────────────────────────────────────────────

const closeQuerySchema = z.object({
    closeReasonId:    z.string().min(1, "Please select a reason"),
    closeReasonOther: z.string().max(500).optional(),
});

export async function closeSalesQuery(
    salesQueryId: string,
    formData: FormData,
): Promise<ActionResult> {
    const parsed = closeQuerySchema.safeParse({
        closeReasonId:    formData.get("closeReasonId"),
        closeReasonOther: formData.get("closeReasonOther") || undefined,
    });

    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
    }

    // If OTHER selected, require a note
    if (parsed.data.closeReasonId === "OTHER" && !parsed.data.closeReasonOther?.trim()) {
        return {
            success: false,
            message: "Validation failed",
            errors: { closeReasonOther: ["Please specify the reason"] },
        };
    }

    try {
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.salesQuery.update({
            where: { id: salesQueryId },
            data: {
                status:           "CLOSED",
                closeReasonId:    parsed.data.closeReasonId,
                closeReasonOther: parsed.data.closeReasonOther ?? null,
                closedAt:         new Date(),
                closedBy:         actor?.id ?? null,
            },
        });

        const reasons = await getCloseReasons();
        const reasonLabel = reasons.find(r => r.id === parsed.data.closeReasonId)?.label ?? parsed.data.closeReasonId;

        await logSalesTimeline(
            salesQueryId,
            `❌ Query Closed — ${reasonLabel}${parsed.data.closeReasonOther ? ` · ${parsed.data.closeReasonOther}` : ""}`,
            actor?.id,
            actor?.name ?? undefined,
            { reason: reasonLabel, note: parsed.data.closeReasonOther },
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Query closed successfully" };
    } catch {
        return { success: false, message: "Failed to close query" };
    }
}

// ── REOPEN ────────────────────────────────────────────────────────────────────

export async function reopenSalesQuery(salesQueryId: string): Promise<ActionResult> {
    try {
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.salesQuery.update({
            where: { id: salesQueryId },
            data: {
                status:           "ACTIVE",
                closeReasonId:    null,
                closeReasonOther: null,
                closedAt:         null,
                closedBy:         null,
            },
        });

        await logSalesTimeline(
            salesQueryId,
            `🔄 Query Reopened`,
            actor?.id,
            actor?.name ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Query reopened" };
    } catch {
        return { success: false, message: "Failed to reopen query" };
    }
}