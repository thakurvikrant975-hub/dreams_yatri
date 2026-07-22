"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma";
import { getCurrentActor, type ActionResult } from "../(marketing)/queries/actions";
import { actionError } from "@/app/lib/action-error";

const SETTINGS_ID = "singleton";

/** An admin-defined policy block beyond the six fixed lists — a free-typed
 * title (e.g. "Visa Policy", "Insurance") plus its own bullet points. */
export type PolicySection = {
    id: string;
    title: string;
    items: string[];
};

export type ItinerarySettings = {
    companyPhone: string;
    companyEmail: string;
    companyAddress: string;
    companyDescription: string;
    documentDisclaimer: string;
    inclusions: string[];
    exclusions: string[];
    termsConditions: string[];
    paymentPolicy: string[];
    amendmentPolicy: string[];
    travelBenefits: string[];
    customPolicySections: PolicySection[];
    defaultMarginPercentage: number;
    defaultGstPercentage: number;
    updatedAt: Date;
    updatedByName: string | null;
};

/** Fetches the single global itinerary-settings row, creating it with the
 * schema's built-in defaults on first read so every caller (the settings
 * page, the package builder, PDF export) can rely on it always existing. */
export async function getItinerarySettings(): Promise<ItinerarySettings> {
    const row = await db.itinerary_settings.upsert({
        where: { id: SETTINGS_ID },
        update: {},
        create: { id: SETTINGS_ID },
    });
    return {
        ...row,
        customPolicySections: (row.customPolicySections as unknown as PolicySection[] | null) ?? [],
    };
}

async function assertNotSalesExecutive(): Promise<string | null> {
    const { actor } = await getCurrentActor();
    const role = (actor as unknown as { role?: string } | undefined)?.role ?? null;
    if (role?.toLowerCase() === "sales executive") {
        return "Sales Executives can't edit itinerary settings — ask an admin.";
    }
    return null;
}

export async function updateItinerarySettings(data: {
    companyPhone: string;
    companyEmail: string;
    companyAddress: string;
    companyDescription: string;
    documentDisclaimer: string;
    inclusions: string[];
    exclusions: string[];
    termsConditions: string[];
    paymentPolicy: string[];
    amendmentPolicy: string[];
    travelBenefits: string[];
    customPolicySections: PolicySection[];
    defaultMarginPercentage: number;
    defaultGstPercentage: number;
}): Promise<ActionResult> {
    try {
        const denied = await assertNotSalesExecutive();
        if (denied) return { success: false, message: denied };

        const { actor, teamMemberId, teamMemberName } = await getCurrentActor();
        void actor;

        const customPolicySections = data.customPolicySections as unknown as Prisma.InputJsonValue;

        await db.itinerary_settings.upsert({
            where: { id: SETTINGS_ID },
            update: {
                ...data,
                customPolicySections,
                updatedBy: teamMemberId,
                updatedByName: teamMemberName,
            },
            create: {
                id: SETTINGS_ID,
                ...data,
                customPolicySections,
                updatedBy: teamMemberId,
                updatedByName: teamMemberName,
            },
        });

        revalidatePath("/dashboard/itinerary-settings");
        return { success: true, data: undefined, message: "Itinerary settings saved" };
    } catch (e) {
        console.error("[updateItinerarySettings] FAILED:", e);
        return actionError(e);
    }
}
