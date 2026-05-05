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

export type SalesQueryStatus = "SUBMITTED" | "ACTIVE" | "CLOSED";

export type QueryStatus = SalesQueryStatus; // alias kept for backwards compat

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
    status: SalesQueryStatus;
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
    createdByName: string | null;
};

// ── Package Requirements Type ─────────────────────────────────────────────────
// Stored as JSON in PackageQuery.requirements
// Schema migration needed: add `requirements Json?` to PackageQuery model

export type PackageRequirements = {
    travellers: {
        leadName: string;
        adults: number;
        children: number;       // 2–12 yrs
        infants: number;        // < 2 yrs
        specialDemands?: string;
    };
    journey: {
        startingPoint: string;
        dateType: "FIXED" | "FLEXIBLE";
        travelDate?: string;        // ISO date string, used when FIXED
        flexibleFrom?: string;      // ISO date string, used when FLEXIBLE
        flexibleTo?: string;        // ISO date string, used when FLEXIBLE
        noOfDays: number;
        noOfNights: number;
        destinations: string[];
        specialDemands?: string;
    };
    stay: {
        types: string[];            // STAR_3 | STAR_4 | STAR_5 | BOUTIQUE | HOMESTAY | RESORT | CAMP | BUDGET
        mealTypes: string[];        // VEG | NON_VEG | JAIN | HALAL | VEGAN
        customMeal?: string;
        specialDemands?: string;
    };
    transport: {
        required: boolean;
        cabTypes: string[];         // SEDAN | SUV | BOLERO | INNOVA | TEMPO | VOLVO | MINI_BUS | BIKE
        includeFlights: boolean;
        specialDemands?: string;
    };
    activities: {
        selected: string[];         // from PRESET_ACTIVITIES enum
        custom: string[];           // free-text additions
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
// BUG FIX: These were used in addFollowUp + closeSalesQuery but never defined,
// causing a runtime ReferenceError on every form submission.

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

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getSalesQueries() {
    console.log("👉 getSalesQueries CALLED");

    const session = await dashboardAuth();
    console.log("👉 SESSION:", session);

    let userId: string | null = null;

    if (session?.user?.email) {
        console.log("👉 Looking for teamMember with email:", session.user.email);

        const teamMember = await db.teamMember.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });

        console.log("👉 TEAM MEMBER:", teamMember);

        userId = teamMember?.id ?? null;
    }

    console.log("👉 FINAL userId:", userId);

    // 🔴 TEST 1: fetch ALL data (ignore filter)
    const allQueries = await db.packageQuery.findMany();
    console.log("👉 TOTAL queries in DB:", allQueries.length);

    // 🔴 TEST 2: fetch filtered data
    const queries = await db.packageQuery.findMany({
        where: userId ? { assignedTo: userId } : {},
        include: {
            _count: {
                select: {
                    queryFollowUps: true,
                    notes: true,
                },
            },
        },
        orderBy: { assignedAt: "desc" },
    });

    console.log("👉 FILTERED queries:", queries.length);
    console.log("👉 SAMPLE query:", queries[0]);

    return queries;
}

export async function getSalesQueryById(id: string) {
    // BUG FIX: The Prisma relation from PackageQuery → QueryFollowUp is named
    // "queryFollowUps" (auto-derived from model name). The old SalesQueryWithDetails
    // type had it as "followUps" which caused the sheet to always show 0 follow-ups.
    // Fix applied in type definitions below — use "queryFollowUps" everywhere.
    return db.packageQuery.findUnique({
        where: { id },
        include: {
            queryFollowUps: { orderBy: { createdAt: "asc" } },
            notes: { orderBy: { createdAt: "asc" } },
            timeline: { orderBy: { createdAt: "asc" } },
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
        { id: "OTHER", label: "Other", requiresNote: true },
    ];
}

// ── FOLLOW-UP ─────────────────────────────────────────────────────────────────

export async function addFollowUp(
    packageQueryId: string,
    formData: FormData,
): Promise<ActionResult> {
    // BUG FIX: followUpSchema was referenced but never defined — caused runtime crash
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
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.queryFollowUp.create({
            data: {
                packageQueryId,
                note: parsed.data.note,
                followUpAt: parsed.data.followUpAt
                    ? new Date(parsed.data.followUpAt)
                    : null,
            },
        });

        if (parsed.data.followUpAt) {
            await db.packageQuery.update({
                where: { id: packageQueryId },
                data: { nextFollowUpAt: new Date(parsed.data.followUpAt) },
            });
        }

        // Activate query when first follow-up is logged
        await db.packageQuery.update({
            where: { id: packageQueryId },
            data: { status: "ACTIVE" },
        });

        await logTimeline(
            packageQueryId,
            `📞 Follow-up logged`,
            actor?.id,
            actor?.name ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Follow-up added" };
    } catch {
        return { success: false, message: "Failed to add follow-up" };
    }
}

// ── CLOSE QUERY ───────────────────────────────────────────────────────────────

export async function closeSalesQuery(
    packageQueryId: string,
    formData: FormData,
): Promise<ActionResult> {
    // BUG FIX: closeQuerySchema was referenced but never defined — caused runtime crash
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
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.packageQuery.update({
            where: { id: packageQueryId },
            data: {
                status: "CLOSED",
                closeReasonId: parsed.data.closeReasonId,
                closeReasonOther: parsed.data.closeReasonOther ?? null,
                closedAt: new Date(),
                closedBy: actor?.id ?? null,
            },
        });

        await logTimeline(
            packageQueryId,
            `❌ Query Closed`,
            actor?.id,
            actor?.name ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Closed successfully" };
    } catch {
        return { success: false, message: "Failed to close query" };
    }
}

// ── REOPEN ────────────────────────────────────────────────────────────────────

export async function reopenSalesQuery(packageQueryId: string): Promise<ActionResult> {
    try {
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.packageQuery.update({
            where: { id: packageQueryId },
            data: {
                status: "ACTIVE",
                closeReasonId: null,
                closeReasonOther: null,
                closedAt: null,
                closedBy: null,
            },
        });

        await logTimeline(
            packageQueryId,
            `🔄 Query Reopened`,
            actor?.id,
            actor?.name ?? undefined,
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Reopened" };
    } catch {
        return { success: false, message: "Failed to reopen" };
    }
}

// ── PACKAGE REQUIREMENTS ──────────────────────────────────────────────────────
// Requires Prisma migration: add `requirements Json?` to PackageQuery model
// Run: npx prisma migrate dev --name add_package_requirements

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
        const session = await dashboardAuth();
        const actor = session?.user;

        await db.packageQuery.update({
            where: { id: packageQueryId },
            data: {
                requirements: parsed.data as Prisma.InputJsonValue,
                // Sync top-level fields from requirements for quick access
                groupSize: parsed.data.travellers.adults + parsed.data.travellers.children,
                destination: parsed.data.journey.destinations[0] ?? null,
                travelDate: parsed.data.journey.travelDate
                    ? new Date(parsed.data.journey.travelDate)
                    : null,
                // Activate the query when requirements are filled
                status: "ACTIVE",
            },
        });

        await logTimeline(
            packageQueryId,
            `📋 Package requirements updated`,
            actor?.id,
            actor?.name ?? undefined,
            {
                destinations: parsed.data.journey.destinations,
                pax: parsed.data.travellers.adults + parsed.data.travellers.children + parsed.data.travellers.infants,
                budget: parsed.data.budget,
            },
        );

        revalidatePath("/dashboard/sales-query");
        return { success: true, data: undefined, message: "Package requirements saved" };
    } catch (err) {
        console.error("savePackageRequirements error:", err);
        return { success: false, message: "Failed to save requirements" };
    }
}