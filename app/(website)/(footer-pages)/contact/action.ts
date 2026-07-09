"use server";

import { db } from "@/app/lib/db";
import { autoAssignLead } from "@/app/lib/queries/auto-assign";
import { z } from "zod";
import { headers } from "next/headers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactActionResult =
    | { success: true; message: string }
    | { success: false; message: string; errors?: Record<string, string[]> };

// ── Validation Schema ─────────────────────────────────────────────────────────

const contactSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name is too long")
        .trim(),

    email: z
        .string()
        .email("Please enter a valid email address")
        .max(255, "Email is too long")
        .trim()
        .optional()
        .or(z.literal("")),

    countryCode: z
        .string()
        .min(2, "Country code is required")
        .max(3),

    dialCode: z
        .string()
        .min(1, "Dial code is required"),

    phone: z
        .string()
        .min(5, "Phone number is too short")
        .max(15, "Phone number is too long")
        .regex(/^\d+$/, "Phone number must contain only digits"),

    message: z
        .string()
        .min(10, "Message must be at least 10 characters")
        .max(2000, "Message is too long")
        .trim()
        .optional()
        .or(z.literal("")),
});

// ── Action ────────────────────────────────────────────────────────────────────

export async function submitContactForm(
    formData: {
        name: string;
        email: string;
        countryCode: string;
        dialCode: string;
        phone: string;
        message: string;
    }
): Promise<ContactActionResult> {
    // 1. Validate
    const parsed = contactSchema.safeParse(formData);

    if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        parsed.error.issues.forEach((issue) => {
            const field = issue.path[0] as string;
            if (!fieldErrors[field]) fieldErrors[field] = [];
            fieldErrors[field].push(issue.message);
        });
        return {
            success: false,
            message: "Please fix the errors below and try again.",
            errors: fieldErrors,
        };
    }

    const { name, email, countryCode, dialCode, phone, message } = parsed.data;

    // 2. Compose full phone with dial code
    const fullPhone = `${dialCode}${phone}`;

    // 3. Extract UTM params from referer header (best-effort)
    let pageUrl: string | undefined;
    try {
        const headersList = await headers();
        pageUrl = headersList.get("referer") ?? undefined;
    } catch {
        // headers() can fail outside request context — safe to ignore
    }

    // 4. Write to DB
    try {
        const created = await db.package_queries.create({
            data: {
                name,
                email: email || null,
                phone: fullPhone,
                countryCode,
                message: message || null,
                source: "CONTACT_FORM",
                status: "SUBMITTED",
                pageUrl: pageUrl ?? null,
            },
        });

        await autoAssignLead(created.id);

        return {
            success: true,
            message:
                "Thanks for reaching out! Our team will contact you within 24 hours.",
        };
    } catch (error) {
        console.error("[contact-action] DB insert failed:", error);

        return {
            success: false,
            message:
                "Something went wrong on our end. Please try calling us directly or email us.",
        };
    }
}