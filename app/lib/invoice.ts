// Single place that turns a booking row into invoice numbers — the dashboard
// admin invoice, the customer-facing invoice and the emailed receipt must show
// identical figures for the same booking, so all of them go through this rather
// than each computing taxable/GST/paid/balance independently (that duplication
// is exactly how the invoice UIs drifted apart before).
//
// Two booking shapes flow through here and they price very differently:
//
//   package  totalAmount_paise is GST-INCLUSIVE (the quote engine adds margin
//            then GST on top), and priceSnapshot carries the rate that was
//            applied — so the taxable base is back-computed out of the total.
//   hotel    totalAmount_paise is the plain sum of nightly rates. No tax is
//            computed anywhere in the hotel booking path, and priceSnapshot is
//            the per-night array (NOT an object with gst_percentage), so the
//            old `priceSnapshot.gst_percentage` read silently yielded 0% on
//            every hotel invoice. Treated as tax-inclusive at the rate stored
//            on the booked room, matching the package convention.

export type InvoiceBookingData = {
    bookingNumber: string;
    createdAt: Date;
    startDate: Date | null;
    endDate: Date | null;
    travellers: number;
    totalAmount_paise: number;
    priceSnapshot: unknown;
    contactEmail: string | null;
    contactPhone: string | null;
    gstStateCode: string | null;
    package: { title: string | null } | null;
    destination?: { name: string | null } | null;
    user: { name: string | null; email: string | null } | null;
    /** Hotel legs. A direct hotel booking has exactly one and no `package`; a
     *  package booking may have several, which are already priced into the
     *  package total and so never form the invoice's line item. */
    hotelBookings?: {
        cityName: string;
        roomType: string;
        roomsCount: number;
        checkInDate: Date;
        checkOutDate: Date;
        hotel?: { name: string | null; gst_percentage?: unknown } | null;
    }[];
    payments: {
        amount_paise: number;
        method: string | null;
        status: string;
        paidAt: Date | null;
        createdAt: Date;
        purpose: string | null;
    }[];
};

export type InvoiceViewModel = {
    /** Which of our services this invoice is for. We sell holiday packages and
     *  hotel stays, and the two are taxed and fulfilled differently, so the
     *  invoice names the service rather than leaving the buyer to infer it from
     *  the line item. */
    serviceType: string;
    lineItemLabel: string;
    /** Second line under the description — nights/rooms for a stay, else null. */
    lineItemDetail: string | null;
    total: number;
    gstPct: number;
    taxable: number;
    gst: number;
    paidPayments: { label: string; amount_paise: number; date: Date }[];
    paid: number;
    balance: number;
    billedToName: string;
    billedToContact: string;
};

/**
 * The exact selection `buildInvoiceViewModel` needs. Every caller spreads this
 * rather than listing fields itself — a page that forgets `hotelBookings` does
 * not fail loudly, it just silently renders a hotel stay as "Holiday package".
 */
export const INVOICE_BOOKING_SELECT = {
    bookingNumber: true, createdAt: true, startDate: true, endDate: true, travellers: true,
    totalAmount_paise: true, priceSnapshot: true, contactEmail: true, contactPhone: true, gstStateCode: true,
    package: { select: { title: true } },
    destination: { select: { name: true } },
    user: { select: { name: true, email: true } },
    hotelBookings: {
        orderBy: { dayNumber: "asc" },
        select: {
            cityName: true, roomType: true, roomsCount: true, checkInDate: true, checkOutDate: true,
            hotel: { select: { name: true, gst_percentage: true } },
        },
    },
    payments: {
        orderBy: { createdAt: "asc" },
        select: { amount_paise: true, method: true, status: true, paidAt: true, createdAt: true, purpose: true },
    },
} as const;

const MS_PER_NIGHT = 86_400_000;

function nightsBetween(from: Date, to: Date): number {
    return Math.max(1, Math.round((to.getTime() - from.getTime()) / MS_PER_NIGHT));
}

export function buildInvoiceViewModel(booking: InvoiceBookingData): InvoiceViewModel {
    const total = booking.totalAmount_paise;

    // A direct hotel booking is one with no package attached — package bookings
    // can also carry hotel legs, but those are already inside the package price
    // and must not retitle the invoice.
    const stay = !booking.package?.title ? booking.hotelBookings?.[0] : undefined;

    // Package: the rate the quote engine actually applied. Hotel: the booked
    // room's own rate. Either way the total is treated as inclusive of it.
    const gstPct = stay
        ? Number(stay.hotel?.gst_percentage ?? 0)
        : (booking.priceSnapshot as { gst_percentage?: number } | null)?.gst_percentage ?? 0;

    const taxable = gstPct > 0 ? Math.round(total / (1 + gstPct / 100)) : total;
    const gst = total - taxable;

    let lineItemLabel: string;
    let lineItemDetail: string | null = null;
    const serviceType = stay ? "Hotel Booking (Accommodation)" : "Holiday Tour Package";

    if (stay) {
        // Previously fell through to "Holiday package" — a hotel booking has no
        // `package` row, so every hotel invoice was mislabelled.
        const hotelName = stay.hotel?.name ?? stay.cityName;
        const nights = nightsBetween(stay.checkInDate, stay.checkOutDate);
        lineItemLabel = `${hotelName} — ${stay.roomType}`;
        lineItemDetail = `${nights} night${nights !== 1 ? "s" : ""} · ${stay.roomsCount} room${stay.roomsCount !== 1 ? "s" : ""}`;
    } else {
        lineItemLabel = booking.package?.title ?? booking.destination?.name ?? "Holiday package";
        lineItemDetail = `${booking.travellers} traveller${booking.travellers !== 1 ? "s" : ""}`;
    }

    const paidPayments = booking.payments
        .filter((p) => p.status === "FULLY_PAID")
        .map((p) => ({
            label: `${p.method ?? "—"}${p.purpose === "TOPUP" ? " (date-change)" : ""}`,
            amount_paise: p.amount_paise,
            date: p.paidAt ?? p.createdAt,
        }));
    const paid = paidPayments.reduce((s, p) => s + p.amount_paise, 0);
    const balance = Math.max(0, total - paid);

    return {
        serviceType,
        lineItemLabel,
        lineItemDetail,
        total,
        gstPct,
        taxable,
        gst,
        paidPayments,
        paid,
        balance,
        billedToName: booking.user?.name ?? "Guest",
        billedToContact: [booking.contactEmail ?? booking.user?.email, booking.contactPhone].filter(Boolean).join(" · "),
    };
}

// ── The rendered document ─────────────────────────────────────────────────────
//
// Everything above turns a Booking into figures. Everything below is what the
// invoice sheet actually prints — and that is deliberately booking-free, because
// ops also raises invoices by hand for business that never became a Booking
// (see app/lib/manual-documents.ts). Both paths build one of these, so there is
// still exactly one invoice layout and the two can't drift apart.

/** One printed row in the description table. The automatic invoice produces
 *  exactly one; a hand-raised invoice can itemise a mixed sale. */
export type InvoiceLine = { label: string; detail: string | null; amount_paise: number };

export type InvoiceDocumentModel = {
    /** As printed at the top — "INV-DY1043", "MINV-2026-0001". Already carries
     *  its own prefix, so the sheet prints it verbatim rather than prefixing. */
    documentNumber: string;
    issueDate: Date;
    serviceType: string;
    gstStateCode: string | null;
    billedToName: string;
    billedToContact: string;
    /** The summary strip under the meta row. Null on an invoice with nothing to
     *  summarise — a hand-raised one for a service with no trip dates — and the
     *  strip is then dropped rather than printed with dashes in it. */
    reference: {
        label: string;
        value: string;
        startDate: Date | null;
        endDate: Date | null;
        travellers: number | null;
    } | null;
    lines: InvoiceLine[];
    taxable: number;
    gstPct: number;
    gst: number;
    total: number;
    paidPayments: { label: string; amount_paise: number; date: Date }[];
    paid: number;
    balance: number;
    /** Numbered conditions at the foot. Defaulted to INVOICE_TERMS; editable on
     *  a hand-raised invoice, where the jurisdiction line isn't always right. */
    terms: string[];
};

/** The standard conditions. Order matters — the closing line is last, after the
 *  conditions proper. */
export const INVOICE_TERMS = [
    "Subject to Shimla jurisdiction.",
    "Subject to realization of Cheque.",
    "Without original Receipt no refund is permissible.",
    "Kindly check all details carefully to avoid un-necessary complications.",
    "Thank you for doing business with us.",
] as const;

/** Booking → printed invoice. The figures still come from
 *  `buildInvoiceViewModel`, so the emailed receipt (which uses that directly)
 *  and this sheet cannot disagree. */
export function bookingToInvoiceDocument(booking: InvoiceBookingData): InvoiceDocumentModel {
    const v = buildInvoiceViewModel(booking);
    return {
        documentNumber: `INV-${booking.bookingNumber}`,
        issueDate: booking.createdAt,
        serviceType: v.serviceType,
        gstStateCode: booking.gstStateCode,
        billedToName: v.billedToName,
        billedToContact: v.billedToContact,
        reference: {
            label: "Booking",
            value: booking.bookingNumber,
            startDate: booking.startDate,
            endDate: booking.endDate,
            travellers: booking.travellers,
        },
        lines: [{ label: v.lineItemLabel, detail: v.lineItemDetail, amount_paise: v.taxable }],
        taxable: v.taxable,
        gstPct: v.gstPct,
        gst: v.gst,
        total: v.total,
        paidPayments: v.paidPayments,
        paid: v.paid,
        balance: v.balance,
        terms: [...INVOICE_TERMS],
    };
}
