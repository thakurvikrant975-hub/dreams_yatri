"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import {
    ManualDocumentSchema,
    computeInvoiceTotals,
    documentNumberSequence,
    formatDocumentNumber,
    parseDay,
    type ManualDocumentInput,
} from "@/app/lib/manual-documents";
import type { ManualDocumentType } from "@/app/generated/prisma";

// ── Auth ──────────────────────────────────────────────────────────────────────

/** The team member raising the document. Stored by id AND by name: the name is
 *  what the document was signed off by at the time, and must survive the member
 *  row being renamed or removed. */
async function requireActor() {
    const session = await dashboardAuth();
    if (!session?.user?.email) return null;

    const member = await db.teamMember.findUnique({
        where: { email: session.user.email },
        select: { id: true, name: true },
    });
    return member ?? { id: null, name: session.user.name ?? session.user.email };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ManualDocumentFormState = {
    success: boolean;
    message: string;
    /** Set on a successful create so the editor can swap itself to the saved
     *  document's URL without a second round trip to look the id up. */
    id?: string;
    documentNumber?: string;
    errors?: Record<string, string[]>;
};

export type ManualDocumentListRow = {
    id: string;
    type: ManualDocumentType;
    documentNumber: string;
    issueDate: Date;
    guestName: string;
    title: string;
    startDate: Date | null;
    endDate: Date | null;
    totalAmount_paise: number;
    createdByName: string | null;
    updatedAt: Date;
};

export type GetManualDocumentsParams = {
    page?: number;
    limit?: number;
    search?: string;
    type?: ManualDocumentType | "all";
};

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getManualDocuments(params: GetManualDocumentsParams = {}) {
    const { page = 1, limit = 20, search = "", type = "all" } = params;

    const where = {
        ...(type !== "all" ? { type } : {}),
        ...(search
            ? {
                OR: [
                    { documentNumber: { contains: search, mode: "insensitive" as const } },
                    { guestName: { contains: search, mode: "insensitive" as const } },
                    { title: { contains: search, mode: "insensitive" as const } },
                ],
            }
            : {}),
    };

    const [documents, totalCount, invoices, vouchers] = await Promise.all([
        db.manualDocument.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, type: true, documentNumber: true, issueDate: true,
                guestName: true, title: true, startDate: true, endDate: true,
                totalAmount_paise: true, createdByName: true, updatedAt: true,
            },
        }),
        db.manualDocument.count({ where }),
        db.manualDocument.count({ where: { type: "INVOICE" } }),
        db.manualDocument.count({ where: { type: "VOUCHER" } }),
    ]);

    return {
        documents: documents as ManualDocumentListRow[],
        totalCount,
        isFiltering: !!search || type !== "all",
        stats: { total: invoices + vouchers, invoices, vouchers },
    };
}

export async function getManualDocument(id: string) {
    return db.manualDocument.findUnique({ where: { id } });
}

// ── Numbering ─────────────────────────────────────────────────────────────────

/**
 * Next number in the type's series for the issue year.
 *
 * Read-then-write, so two people saving at the same instant can compute the same
 * number — which is why the column is UNIQUE and `createManualDocument` retries
 * on collision rather than trusting this to be atomic. A sequence table would be
 * airtight but would also hand out numbers to abandoned drafts, leaving visible
 * gaps in a document series that ops has to explain to an auditor.
 */
async function nextDocumentNumber(type: ManualDocumentType, year: number): Promise<string> {
    const prefix = formatDocumentNumber(type, year, 0).slice(0, -4);
    const latest = await db.manualDocument.findFirst({
        where: { type, documentNumber: { startsWith: prefix } },
        orderBy: { documentNumber: "desc" },
        select: { documentNumber: true },
    });
    return formatDocumentNumber(type, year, documentNumberSequence(latest?.documentNumber ?? "") + 1);
}

// ── Shared column mapping ─────────────────────────────────────────────────────

/** The scalar columns, derived from the validated input. The payload is stored
 *  whole alongside; these exist so the list can search, sort and total without
 *  parsing every blob. */
function toColumns(input: ManualDocumentInput) {
    const issueDate = parseDay(input.issueDate)!;
    return {
        issueDate,
        guestName: input.guestName,
        guestContact: input.guestContact,
        title: input.title,
        startDate: parseDay(input.startDate),
        endDate: parseDay(input.endDate),
        travellers: input.travellers,
        notes: input.notes,
        totalAmount_paise: input.type === "INVOICE" ? computeInvoiceTotals(input.payload).total : 0,
        payload: input.payload,
    };
}

function validate(raw: unknown): { ok: true; data: ManualDocumentInput } | { ok: false; state: ManualDocumentFormState } {
    const parsed = ManualDocumentSchema.safeParse(raw);
    if (parsed.success) return { ok: true, data: parsed.data };

    // Flatten nested paths ("payload.lines.0.label") to a readable key so the
    // editor can surface the failure next to the row that caused it.
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        (errors[key] ??= []).push(issue.message);
    }
    return {
        ok: false,
        state: { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed", errors },
    };
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createManualDocument(raw: unknown): Promise<ManualDocumentFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const checked = validate(raw);
    if (!checked.ok) return checked.state;
    const input = checked.data;

    const columns = toColumns(input);
    const year = columns.issueDate.getFullYear();

    // Three attempts: enough to ride out two people saving at the same moment,
    // and a bounded loop rather than a retry that could spin on a genuine fault.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const created = await db.manualDocument.create({
                data: {
                    ...columns,
                    type: input.type,
                    documentNumber: await nextDocumentNumber(input.type, year),
                    createdById: actor.id,
                    createdByName: actor.name,
                },
                select: { id: true, documentNumber: true },
            });
            revalidatePath("/dashboard/manual-documents");
            return {
                success: true,
                message: `${created.documentNumber} created`,
                id: created.id,
                documentNumber: created.documentNumber,
            };
        } catch (error) {
            const code = (error as { code?: string }).code;
            // P2002 — someone else took the number between the read and the
            // insert. Recompute and try again; anything else is a real failure.
            if (code !== "P2002" || attempt === 2) {
                return { success: false, message: "Could not save the document. Please try again." };
            }
        }
    }

    return { success: false, message: "Could not save the document. Please try again." };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateManualDocument(id: string, raw: unknown): Promise<ManualDocumentFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const checked = validate(raw);
    if (!checked.ok) return checked.state;
    const input = checked.data;

    const existing = await db.manualDocument.findUnique({ where: { id }, select: { type: true, documentNumber: true } });
    if (!existing) return { success: false, message: "Document not found" };

    // The number is the document's identity on paper and a guest may already be
    // holding it — an invoice cannot become a voucher under the same number.
    if (existing.type !== input.type) {
        return { success: false, message: "A document's type cannot be changed. Create a new one instead." };
    }

    try {
        await db.manualDocument.update({
            where: { id },
            data: { ...toColumns(input), updatedByName: actor.name },
        });
        revalidatePath("/dashboard/manual-documents");
        revalidatePath(`/dashboard/manual-documents/${id}`);
        return { success: true, message: `${existing.documentNumber} saved`, id, documentNumber: existing.documentNumber };
    } catch {
        return { success: false, message: "Could not save the document. Please try again." };
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteManualDocument(id: string): Promise<ManualDocumentFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.manualDocument.delete({ where: { id } });
        revalidatePath("/dashboard/manual-documents");
        return { success: true, message: "Document deleted" };
    } catch {
        return { success: false, message: "Could not delete the document." };
    }
}
