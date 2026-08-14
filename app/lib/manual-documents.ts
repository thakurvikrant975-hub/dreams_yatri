import { z } from "zod";
import {
    INVOICE_TERMS,
    type InvoiceDocumentModel,
    type InvoiceLine,
} from "@/app/lib/invoice";
import type { VoucherDocumentData } from "@/app/components/voucher/VoucherDocument";

/**
 * Invoices and vouchers the operations team fills in by hand.
 *
 * The automatic documents are derived from a Booking row, so they only exist for
 * trips sold through the site. Ops issues the same two documents for business
 * that never became a Booking — a walk-in, a B2B agent, a stay arranged over the
 * phone. This module is the whole of that difference: it defines what ops types
 * in, validates it, and converts it into the exact models the shared
 * InvoiceDocument / VoucherDocument components already render.
 *
 * Nothing here renders anything. That is the point — a hand-raised invoice must
 * come out byte-identical in layout to a generated one, which only holds if both
 * feed the same components rather than each carrying its own copy of the sheet.
 *
 * Dates cross the JSON boundary as "YYYY-MM-DD" strings and are read back with
 * `parseDay`, never `new Date(string)` on a full ISO timestamp: a document dated
 * the 3rd must print as the 3rd regardless of the server's timezone.
 */

// ── Dates ─────────────────────────────────────────────────────────────────────

/** A calendar day as typed into a date input. Not a timestamp — a voucher's
 *  "Day 3 · 14 Mar" is a date on a printed page, not an instant. */
const DayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

/** "YYYY-MM-DD" → local midnight. Parsed field-wise rather than handed to the
 *  Date constructor, which reads a bare date string as UTC and can print the
 *  previous day for anyone east or west of it. */
export function parseDay(value: string | null | undefined): Date | null {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

/** Date → "YYYY-MM-DD", for putting a stored date back into a date input. */
export function toDayString(value: Date | null | undefined): string {
    if (!value) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

// ── Money ─────────────────────────────────────────────────────────────────────

/**
 * Rupees as typed (possibly blank, possibly with a stray comma or rupee sign) →
 * integer paise. Blank is 0, not an error: a half-filled row being edited must
 * not block the form.
 *
 * Exported because the editor computes its live totals with it too. If the form
 * converted rupees its own way and the schema converted them another, the figure
 * on screen and the figure on the saved invoice would differ by a rounding step
 * on exactly the amounts that matter.
 */
export function rupeeInputToPaise(value: string | number): number {
    const n = typeof value === "number" ? value : Number(String(value).replace(/[,\s₹]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Integer paise → what goes back into a rupee input. Blank rather than "0" for
 *  an empty amount, so a fresh row doesn't have to be cleared before typing. */
export function paiseToRupeeInput(paise: number): string {
    return paise ? String(paise / 100) : "";
}

const RupeeField = z
    .union([z.string(), z.number()])
    .transform(rupeeInputToPaise)
    .pipe(z.number().int().min(0, "Amount cannot be negative"));

// ── Invoice payload ───────────────────────────────────────────────────────────

const InvoiceLineSchema = z.object({
    label: z.string().trim().min(1, "Description is required").max(300),
    detail: z.string().trim().max(300).nullish().transform((v) => v || null),
    amount: RupeeField,
});

const InvoicePaymentSchema = z.object({
    label: z.string().trim().min(1, "Say how it was received").max(120),
    date: DayString,
    amount: RupeeField,
});

export const ManualInvoicePayloadSchema = z.object({
    serviceType: z.string().trim().min(1).max(120).default("Holiday Tour Package"),
    gstStateCode: z.string().trim().max(10).nullish().transform((v) => v || null),
    gstPct: z.coerce.number().min(0).max(28).default(0),
    /**
     * Whether the amounts typed into the line items already contain the GST.
     *
     * The automatic invoice always back-computes, because the quote engine hands
     * it a tax-inclusive total. Ops typing an invoice by hand usually has the
     * pre-tax figure in front of them and wants GST added on top, so that is the
     * default — but a rate quoted to a guest as a single all-in number has to be
     * enterable too, without ops doing the division themselves.
     */
    amountsIncludeGst: z.boolean().default(false),
    lines: z.array(InvoiceLineSchema).min(1, "Add at least one line item"),
    payments: z.array(InvoicePaymentSchema).default([]),
    terms: z.array(z.string().trim().min(1)).default([...INVOICE_TERMS]),
});

export type ManualInvoicePayload = z.infer<typeof ManualInvoicePayloadSchema>;

/** What a fresh invoice form starts with. */
export const EMPTY_INVOICE_PAYLOAD: ManualInvoicePayload = {
    serviceType: "Holiday Tour Package",
    gstStateCode: null,
    gstPct: 5,
    amountsIncludeGst: false,
    lines: [{ label: "", detail: null, amount: 0 }],
    payments: [],
    terms: [...INVOICE_TERMS],
};

/**
 * Line items + GST rate → the printed figures.
 *
 * Split out from the converter below because the editor needs the same numbers
 * live, before anything is saved — a totals strip that computes GST its own way
 * is exactly how the figure on screen ends up disagreeing with the figure on
 * paper.
 */
export function computeInvoiceTotals(payload: {
    lines: { amount: number }[];
    payments: { amount: number }[];
    gstPct: number;
    amountsIncludeGst: boolean;
}) {
    const sum = payload.lines.reduce((s, l) => s + l.amount, 0);
    const pct = payload.gstPct;

    // Inclusive: the typed sum IS the total, and the taxable base is backed out
    // of it — same arithmetic the booking invoice does. Exclusive: the typed sum
    // is the base and GST goes on top.
    const taxable = payload.amountsIncludeGst && pct > 0 ? Math.round(sum / (1 + pct / 100)) : sum;
    const gst = payload.amountsIncludeGst ? sum - taxable : Math.round(taxable * (pct / 100));
    const total = taxable + gst;

    const paid = payload.payments.reduce((s, p) => s + p.amount, 0);
    return { taxable, gst, total, paid, balance: Math.max(0, total - paid) };
}

// ── The invoice as the form holds it ──────────────────────────────────────────
//
// Stored amounts are integer paise; typed amounts are rupees, mid-edit, and
// sometimes not a number yet ("12,", "", "1.5"). The draft is that in-between
// state. It is what the form's state is, and what the form posts — the schema
// above converts it on the way in, so the rupee→paise rounding happens exactly
// once, on the server, for both the create and the update path.

export type ManualInvoiceDraft = Omit<ManualInvoicePayload, "lines" | "payments"> & {
    lines: { label: string; detail: string | null; amount: string }[];
    payments: { label: string; date: string; amount: string }[];
};

export function invoicePayloadToDraft(payload: ManualInvoicePayload): ManualInvoiceDraft {
    return {
        ...payload,
        lines: payload.lines.map((l) => ({ ...l, amount: paiseToRupeeInput(l.amount) })),
        payments: payload.payments.map((p) => ({ ...p, amount: paiseToRupeeInput(p.amount) })),
    };
}

/** Live totals for the form, computed through the same arithmetic the saved
 *  document will use. */
export function computeDraftTotals(draft: ManualInvoiceDraft) {
    return computeInvoiceTotals({
        gstPct: draft.gstPct,
        amountsIncludeGst: draft.amountsIncludeGst,
        lines: draft.lines.map((l) => ({ amount: rupeeInputToPaise(l.amount) })),
        payments: draft.payments.map((p) => ({ amount: rupeeInputToPaise(p.amount) })),
    });
}

export const EMPTY_INVOICE_DRAFT: ManualInvoiceDraft = invoicePayloadToDraft(EMPTY_INVOICE_PAYLOAD);

// ── Voucher payload ───────────────────────────────────────────────────────────

/** Fulfilment state as ops sets it by hand. The automatic voucher reads this off
 *  the ops tables; here it is simply what ops says it is, because the hotel it
 *  is vouching for was booked outside the system. */
const StatusSchema = z.object({
    isConfirmed: z.boolean().default(false),
    /** Shown verbatim in the badge when not confirmed — "PENDING", "ON_REQUEST". */
    status: z.string().trim().min(1).max(40).default("PENDING"),
});

const VoucherActivitySchema = StatusSchema.extend({
    name: z.string().trim().min(1, "Activity name is required").max(200),
    isOptional: z.boolean().default(false),
});

const VoucherDaySchema = z.object({
    day: z.coerce.number().int().min(1),
    title: z.string().trim().min(1, "Day title is required").max(200),
    date: DayString.nullish().transform((v) => v || null),
    hotelName: z.string().trim().max(200).nullish().transform((v) => v || null),
    hotelStars: z.coerce.number().int().min(1).max(5).nullish().transform((v) => v ?? null),
    roomLabel: z.string().trim().max(200).nullish().transform((v) => v || null),
    hotelStatus: StatusSchema.nullish().transform((v) => v ?? null),
    /** Priced meal lines. On a hand-raised voucher these are just the meals ops
     *  wants listed in the Meals column. */
    meals: z.array(z.string().trim().min(1)).default([]),
    mealPlan: z.string().trim().max(120).nullish().transform((v) => v || null),
    /** "Breakfast, Dinner included" under the hotel name. Kept separate from
     *  `meals` for the same reason the automatic voucher does: what the rate
     *  includes and what the day's itinerary lists are not the same statement. */
    mealsIncluded: z.array(z.string().trim().min(1)).default([]),
    activities: z.array(VoucherActivitySchema).default([]),
});

const VoucherHotelSchema = z.object({
    dayNumber: z.coerce.number().int().min(1),
    hotelName: z.string().trim().min(1, "Hotel name is required").max(200),
    city: z.string().trim().max(120).nullish().transform((v) => v || null),
    state: z.string().trim().max(120).nullish().transform((v) => v || null),
    checkInDate: DayString,
    checkOutDate: DayString,
    roomType: z.string().trim().max(120).default(""),
    roomsCount: z.coerce.number().int().min(1).default(1),
    isConfirmed: z.boolean().default(false),
    status: z.string().trim().min(1).max(40).default("PENDING"),
});

const VoucherCabSchema = z.object({
    legNumber: z.coerce.number().int().min(1),
    fromLocation: z.string().trim().max(200).default(""),
    toLocation: z.string().trim().max(200).default(""),
    transferDate: DayString,
    cabType: z.string().trim().max(120).default("Cab"),
    cabCount: z.coerce.number().int().min(1).default(1),
    /** 0 means "not recorded" — the sheet then omits the "(n-seater)" note
     *  rather than printing "(0-seater)". */
    capacity: z.coerce.number().int().min(0).default(0),
    isConfirmed: z.boolean().default(false),
    status: z.string().trim().min(1).max(40).default("PENDING"),
    driverName: z.string().trim().max(120).nullish().transform((v) => v || null),
    driverPhone: z.string().trim().max(30).nullish().transform((v) => v || null),
    vehicleNumber: z.string().trim().max(30).nullish().transform((v) => v || null),
});

export const ManualVoucherPayloadSchema = z.object({
    /**
     * Drives the same three sections the automatic voucher gates on: the
     * day-by-day table, inclusions/exclusions and policies. False produces the
     * hotel-booking voucher — an accommodation table and nothing else — which is
     * the right document for a stay ops arranged with no itinerary around it.
     */
    isPackage: z.boolean().default(true),
    durationLabel: z.string().trim().max(120).nullish().transform((v) => v || null),
    stayLabel: z.string().trim().max(120).nullish().transform((v) => v || null),
    days: z.array(VoucherDaySchema).default([]),
    hotels: z.array(VoucherHotelSchema).default([]),
    cabs: z.array(VoucherCabSchema).default([]),
    inclusions: z.array(z.string().trim().min(1)).default([]),
    exclusions: z.array(z.string().trim().min(1)).default([]),
    policies: z
        .array(z.object({
            title: z.string().trim().min(1, "Policy title is required").max(200),
            points: z.array(z.string().trim().min(1)).default([]),
        }))
        .default([]),
});

export type ManualVoucherPayload = z.infer<typeof ManualVoucherPayloadSchema>;

export const EMPTY_VOUCHER_PAYLOAD: ManualVoucherPayload = {
    isPackage: true,
    durationLabel: null,
    stayLabel: null,
    days: [],
    hotels: [],
    cabs: [],
    inclusions: [],
    exclusions: [],
    policies: [],
};

// ── The document itself ───────────────────────────────────────────────────────

/** The fields both document types share — who it is for, what it is for, when.
 *  Stored as columns rather than inside the payload so the list page can search
 *  and sort on them without reading every blob. */
export const ManualDocumentHeaderSchema = z.object({
    issueDate: DayString,
    guestName: z.string().trim().min(1, "Guest name is required").max(200),
    guestContact: z.string().trim().max(200).nullish().transform((v) => v || null),
    title: z.string().trim().min(1, "A title is required").max(200),
    startDate: DayString.nullish().transform((v) => v || null),
    endDate: DayString.nullish().transform((v) => v || null),
    travellers: z.coerce.number().int().min(1).max(200).default(1),
    notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
});

export type ManualDocumentHeader = z.infer<typeof ManualDocumentHeaderSchema>;

export const ManualInvoiceSchema = ManualDocumentHeaderSchema.extend({
    type: z.literal("INVOICE"),
    payload: ManualInvoicePayloadSchema,
});

export const ManualVoucherSchema = ManualDocumentHeaderSchema.extend({
    type: z.literal("VOUCHER"),
    payload: ManualVoucherPayloadSchema,
})
    // A voucher whose end precedes its start prints a nonsense date range and
    // nothing downstream would catch it — there is no booking engine behind this
    // document to reject the dates first.
    .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
        message: "Trip end date cannot be before the start date",
        path: ["endDate"],
    });

export const ManualDocumentSchema = z.discriminatedUnion("type", [
    ManualInvoiceSchema,
    ManualVoucherSchema,
]);

export type ManualDocumentInput = z.infer<typeof ManualDocumentSchema>;

// ── Document numbering ────────────────────────────────────────────────────────

/** Distinct from anything the booking engine issues, and self-describing on
 *  paper: a guest holding MINV-2026-0007 is holding a hand-raised invoice. */
export const DOCUMENT_PREFIX = { INVOICE: "MINV", VOUCHER: "MVCH" } as const;

/** `MINV-2026-0007` → 7. Returns 0 for anything that doesn't parse, so a stray
 *  row can't drag the next number backwards. */
export function documentNumberSequence(documentNumber: string): number {
    return Number(documentNumber.split("-").pop()) || 0;
}

export function formatDocumentNumber(type: keyof typeof DOCUMENT_PREFIX, year: number, sequence: number): string {
    return `${DOCUMENT_PREFIX[type]}-${year}-${String(sequence).padStart(4, "0")}`;
}

// ── Payload → the shared document components ──────────────────────────────────

/** The stored row, as much of it as the converters need. */
export type ManualDocumentRecord = {
    documentNumber: string;
    issueDate: Date;
    guestName: string;
    guestContact: string | null;
    title: string;
    startDate: Date | null;
    endDate: Date | null;
    travellers: number;
};

export function manualInvoiceToDocument(
    record: ManualDocumentRecord,
    payload: ManualInvoicePayload,
): InvoiceDocumentModel {
    const totals = computeInvoiceTotals(payload);
    const lines: InvoiceLine[] = payload.lines.map((l) => ({
        label: l.label,
        detail: l.detail,
        // Inclusive entry means the typed row amounts add up to the total, not to
        // the taxable base — printing them unchanged above a backed-out subtotal
        // would show a column that doesn't sum to the line under it. Each row is
        // scaled down by the same ratio the total was.
        amount_paise: payload.amountsIncludeGst && totals.total > 0
            ? Math.round((l.amount * totals.taxable) / totals.total)
            : l.amount,
    }));

    return {
        documentNumber: record.documentNumber,
        issueDate: record.issueDate,
        serviceType: payload.serviceType,
        gstStateCode: payload.gstStateCode,
        billedToName: record.guestName,
        billedToContact: record.guestContact ?? "",
        // No booking number to quote, so the strip carries the trip itself. It is
        // dropped entirely when there are no dates either — see InvoiceDocument.
        reference: record.startDate || record.endDate
            ? {
                label: "Trip",
                value: record.title,
                startDate: record.startDate,
                endDate: record.endDate,
                travellers: record.travellers,
            }
            : null,
        lines,
        taxable: totals.taxable,
        gstPct: payload.gstPct,
        gst: totals.gst,
        total: totals.total,
        paidPayments: payload.payments.map((p) => ({
            label: p.label,
            amount_paise: p.amount,
            date: parseDay(p.date) ?? record.issueDate,
        })),
        paid: totals.paid,
        balance: totals.balance,
        terms: payload.terms,
    };
}

export function manualVoucherToDocument(
    record: ManualDocumentRecord,
    payload: ManualVoucherPayload,
): VoucherDocumentData {
    const start = record.startDate ?? record.issueDate;
    const end = record.endDate ?? start;
    // Inclusive of both ends: a trip that starts and finishes on the same day is
    // one day, not zero.
    const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

    return {
        bookingNumber: record.documentNumber,
        createdAt: record.issueDate,
        startDate: start,
        endDate: end,
        duration,
        travellers: record.travellers,
        tripTitle: record.title,
        durationLabel: payload.durationLabel,
        stayLabel: payload.stayLabel,
        guestName: record.guestName,
        guestContact: record.guestContact,
        isPackage: payload.isPackage,
        days: payload.days.map((d) => ({
            day: d.day,
            title: d.title,
            date: parseDay(d.date),
            hotelName: d.hotelName,
            hotelStars: d.hotelStars,
            roomLabel: d.roomLabel,
            hotelStatus: d.hotelStatus,
            meals: d.meals,
            mealPlan: d.mealPlan,
            mealsIncluded: d.mealsIncluded,
            activities: d.activities,
        })),
        inclusions: payload.inclusions,
        exclusions: payload.exclusions,
        policies: payload.policies,
        hotels: payload.hotels.map((h) => ({
            dayNumber: h.dayNumber,
            cityName: h.city ?? "",
            checkInDate: parseDay(h.checkInDate) ?? start,
            checkOutDate: parseDay(h.checkOutDate) ?? start,
            roomType: h.roomType,
            roomsCount: h.roomsCount,
            isConfirmed: h.isConfirmed,
            status: h.status,
            hotel: { name: h.hotelName, city: h.city, state: h.state },
        })),
        cabs: payload.cabs.map((c) => ({
            legNumber: c.legNumber,
            fromLocation: c.fromLocation,
            toLocation: c.toLocation,
            transferDate: parseDay(c.transferDate) ?? start,
            cabType: c.cabType,
            cabCount: c.cabCount,
            capacity: c.capacity,
            isConfirmed: c.isConfirmed,
            status: c.status,
            driverName: c.driverName,
            driverPhone: c.driverPhone,
            vehicleNumber: c.vehicleNumber,
        })),
    };
}
