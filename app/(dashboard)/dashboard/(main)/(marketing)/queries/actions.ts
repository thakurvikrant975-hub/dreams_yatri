"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
    | { success: true;  data: T;    message: string }
    | { success: false; data?: never; message: string; errors?: Record<string, string[]> };

export type QueryStatus = "SUBMITTED" | "IN_PROGRESS" | "VERIFIED" | "REJECTED";
export type QuerySource = "WEBSITE_FORM" | "LANDING_PAGE" | "WHATSAPP" | "PHONE_CALL" | "REFERRAL" | "OTHER";

export type PackageQuery = {
    id:               string;
    name:             string;
    email:            string | null;
    phone:            string;
    message:          string | null;
    packageName:      string | null;
    destination:      string | null;
    travelDate:       Date | null;
    groupSize:        number | null;
    source:           QuerySource;
    status:           QueryStatus;
    verified:         boolean;
    verifiedAt:       Date | null;
    verifiedBy:       string | null;
    rejectionReasonId: string | null;
    rejectionNote:    string | null;
    callAttempts:     number;
    lastAttemptAt:    Date | null;
    nextFollowUpAt:   Date | null;
    assignedTo:       string | null;
    assignedAt:       Date | null;
    createdAt:        Date;
    updatedAt:        Date;
    rejectionReason:  { id: string; label: string } | null;
    _count:           { notes: number };
};

export type RejectionReason = {
    id:          string;
    label:       string;
    description: string | null;
    isSystem:    boolean;
    isActive:    boolean;
    sortOrder:   number;
    createdAt:   Date;
    updatedAt:   Date;
    _count:      { queries: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logTimeline(
    queryId: string,
    event: string,
    actorId?: string,
    actorName?: string,
    meta?: Record<string, unknown>,
) {
    await db.queryTimeline.create({
        data: { queryId, event, actorId, actorName, meta: meta ?? Prisma.JsonNull },
    });
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getQueries(): Promise<PackageQuery[]> {
    return db.packageQuery.findMany({
        include: {
            rejectionReason: { select: { id: true, label: true } },
            _count: { select: { notes: true } },
        },
        orderBy: { createdAt: "desc" },
    }) as Promise<PackageQuery[]>;
}

export async function getQueryById(id: string) {
    return db.packageQuery.findUnique({
        where: { id },
        include: {
            rejectionReason: true,
            notes: { orderBy: { createdAt: "asc" } },
            timeline: { orderBy: { createdAt: "asc" } },
        },
    });
}

export async function getRejectionReasons(): Promise<RejectionReason[]> {
    return db.rejectionReason.findMany({
        where: { isActive: true },
        include: { _count: { select: { queries: true } } },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }) as Promise<RejectionReason[]>;
}

// ── STATUS TRANSITIONS ────────────────────────────────────────────────────────

const markInProgressSchema = z.object({
    queryId: z.string().min(1),
});

export async function markInProgress(queryId: string): Promise<ActionResult> {
    try {
        const session = await dashboardAuth();
        const actor   = session?.user;

        await db.packageQuery.update({
            where: { id: queryId },
            data:  { status: "IN_PROGRESS", callAttempts: { increment: 1 }, lastAttemptAt: new Date() },
        });

        await logTimeline(queryId, "Marked as In Progress — call attempted", actor?.id, actor?.name ?? undefined);
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Query moved to In Progress" };
    } catch {
        return { success: false, message: "Failed to update status" };
    }
}

// ── VERIFY ────────────────────────────────────────────────────────────────────

export async function verifyQuery(queryId: string): Promise<ActionResult> {
    try {
        const session = await dashboardAuth();
        const actor   = session?.user;

        await db.packageQuery.update({
            where: { id: queryId },
            data: {
                status:     "VERIFIED",
                verified:   true,
                verifiedAt: new Date(),
                verifiedBy: actor?.id ?? null,
            },
        });

        await logTimeline(queryId, "Query verified — lead confirmed interested", actor?.id, actor?.name ?? undefined);
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Query verified successfully" };
    } catch {
        return { success: false, message: "Failed to verify query" };
    }
}

// ── REJECT ────────────────────────────────────────────────────────────────────

const rejectSchema = z.object({
    rejectionReasonId: z.string().min(1, "Select a rejection reason"),
    rejectionNote:     z.string().max(500).optional(),
});

export async function rejectQuery(
    queryId: string,
    formData: FormData,
): Promise<ActionResult> {
    const parsed = rejectSchema.safeParse({
        rejectionReasonId: formData.get("rejectionReasonId"),
        rejectionNote:     formData.get("rejectionNote") || undefined,
    });

    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
    }

    try {
        const session = await dashboardAuth();
        const actor   = session?.user;

        const reason = await db.rejectionReason.findUnique({
            where: { id: parsed.data.rejectionReasonId },
        });

        await db.packageQuery.update({
            where: { id: queryId },
            data: {
                status:            "REJECTED",
                verified:          false,
                rejectionReasonId: parsed.data.rejectionReasonId,
                rejectionNote:     parsed.data.rejectionNote ?? null,
            },
        });

        await logTimeline(
            queryId,
            `Query rejected: ${reason?.label ?? "Unknown reason"}`,
            actor?.id,
            actor?.name ?? undefined,
            { note: parsed.data.rejectionNote },
        );

        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Query rejected" };
    } catch {
        return { success: false, message: "Failed to reject query" };
    }
}

// ── LOG CALL ATTEMPT ──────────────────────────────────────────────────────────

export async function logCallAttempt(
    queryId: string,
    nextFollowUpAt?: Date,
): Promise<ActionResult> {
    try {
        const session = await dashboardAuth();
        const actor   = session?.user;

        await db.packageQuery.update({
            where: { id: queryId },
            data: {
                callAttempts:   { increment: 1 },
                lastAttemptAt:  new Date(),
                nextFollowUpAt: nextFollowUpAt ?? null,
                status:         "IN_PROGRESS",
            },
        });

        await logTimeline(
            queryId,
            "Call attempt logged",
            actor?.id,
            actor?.name ?? undefined,
            { nextFollowUp: nextFollowUpAt },
        );

        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Call attempt logged" };
    } catch {
        return { success: false, message: "Failed to log call attempt" };
    }
}

// ── NOTES ─────────────────────────────────────────────────────────────────────

const noteSchema = z.object({
    content: z.string().min(1, "Note cannot be empty").max(1000),
});

export async function addNote(
    queryId: string,
    formData: FormData,
): Promise<ActionResult> {
    const parsed = noteSchema.safeParse({ content: formData.get("content") });
    if (!parsed.success) {
        return { success: false, message: "Note is required", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        const session = await dashboardAuth();
        const actor   = session?.user;

        await db.queryNote.create({
            data: {
                queryId,
                authorId: actor?.id ?? "system",
                content:  parsed.data.content,
            },
        });

        await logTimeline(queryId, "Note added", actor?.id, actor?.name ?? undefined);
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: "Note added" };
    } catch {
        return { success: false, message: "Failed to add note" };
    }
}

// ── REJECTION REASONS CRUD ───────────────────────────────────────────────────

export type RejectionReasonFormState = {
    success:  boolean;
    message:  string;
    errors?:  Record<string, string[]>;
};

const reasonSchema = z.object({
    label:       z.string().min(1, "Label is required").max(100),
    description: z.string().max(300).optional(),
});

export async function createRejectionReason(
    _prev: RejectionReasonFormState,
    formData: FormData,
): Promise<RejectionReasonFormState> {
    const parsed = reasonSchema.safeParse({
        label:       formData.get("label"),
        description: formData.get("description") || undefined,
    });
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    try {
        await db.rejectionReason.create({ data: parsed.data });
        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/queries/rejection-reasons");
        return { success: true, message: "Rejection reason created" };
    } catch {
        return { success: false, message: "Failed to create reason" };
    }
}

export async function deleteRejectionReason(id: string): Promise<ActionResult> {
    try {
        const reason = await db.rejectionReason.findUnique({ where: { id } });
        if (reason?.isSystem) return { success: false, message: "System reasons cannot be deleted" };

        await db.rejectionReason.delete({ where: { id } });
        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/queries/rejection-reasons");
        return { success: true, data: undefined, message: "Reason deleted" };
    } catch {
        return { success: false, message: "Failed to delete reason" };
    }
}

export async function toggleRejectionReason(id: string, isActive: boolean): Promise<ActionResult> {
    try {
        await db.rejectionReason.update({ where: { id }, data: { isActive } });
        revalidatePath("/dashboard/queries");
        return { success: true, data: undefined, message: `Reason ${isActive ? "enabled" : "disabled"}` };
    } catch {
        return { success: false, message: "Failed to update reason" };
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// ADD THIS TO YOUR EXISTING actions.ts
// ─────────────────────────────────────────────────────────────────────────────

export type ManualQueryFormState = {
    success:  boolean;
    message:  string;
    errors?:  Record<string, string[]>;
};

const manualQuerySchema = z.object({
    name:        z.string().min(1, "Name is required").max(100),
    phone:       z.string().min(6, "Valid phone number required").max(20),
    email:       z.string().email("Invalid email").optional().or(z.literal("")),
    destination: z.string().optional(),
    packageName: z.string().optional(),
    groupSize:   z.coerce.number().int().min(1).max(500).optional(),
    travelDate:  z.string().optional(),
    message:     z.string().max(2000).optional(),
    source:      z.enum(["WEBSITE_FORM","LANDING_PAGE","WHATSAPP","PHONE_CALL","REFERRAL","OTHER"]).default("PHONE_CALL"),
});

export async function createManualQuery(
    _prev: ManualQueryFormState,
    formData: FormData,
): Promise<ManualQueryFormState> {
    const raw = {
        name:        formData.get("name"),
        phone:       formData.get("phone"),
        email:       formData.get("email") || undefined,
        destination: formData.get("destination") || undefined,
        packageName: formData.get("packageName") || undefined,
        groupSize:   formData.get("groupSize") || undefined,
        travelDate:  formData.get("travelDate") || undefined,
        message:     formData.get("message") || undefined,
        source:      formData.get("source") || "PHONE_CALL",
    };

    const parsed = manualQuerySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
    }

    try {
        const session = await dashboardAuth();
        const actor   = session?.user;

        const { travelDate, email, ...rest } = parsed.data;

        const query = await db.packageQuery.create({
            data: {
                ...rest,
                email:      email || null,
                travelDate: travelDate ? new Date(travelDate) : null,
                status:     "SUBMITTED",
                verified:   false,
            },
        });

        await logTimeline(
            query.id,
            `Query manually created by ${actor?.name ?? "team member"}`,
            actor?.id,
            actor?.name ?? undefined,
            { source: parsed.data.source },
        );

        revalidatePath("/dashboard/queries");
        return { success: true, message: `Query for ${parsed.data.name} saved successfully` };
    } catch {
        return { success: false, message: "Failed to save query" };
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// UPDATE YOUR page.tsx header section — replace the existing header div with:
// ─────────────────────────────────────────────────────────────────────────────

/*
import { AddQueryDialog } from "./AddQueryDialog";   // add this import

// Replace the header div:
<div className="flex items-start justify-between">
    <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
            <h1 className="text-xl font-semibold">Lead Queries</h1>
            <p className="text-sm text-muted-foreground">
                Manage, verify, and action all incoming enquiries
            </p>
        </div>
    </div>

    <AddQueryDialog />   // ← ADD THIS
</div>
*/