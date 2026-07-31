// Single place that turns a booking row into invoice numbers — the dashboard
// admin invoice and the customer-facing invoice must show identical figures
// for the same booking, so both go through this rather than each computing
// taxable/GST/paid/balance independently (that duplication is exactly how the
// two invoice UIs drifted apart before).

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
    lineItemLabel: string;
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

export function buildInvoiceViewModel(booking: InvoiceBookingData): InvoiceViewModel {
    const total = booking.totalAmount_paise;
    const gstPct = (booking.priceSnapshot as { gst_percentage?: number } | null)?.gst_percentage ?? 0;
    const taxable = gstPct > 0 ? Math.round(total / (1 + gstPct / 100)) : total;
    const gst = total - taxable;

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
        lineItemLabel: booking.package?.title ?? booking.destination?.name ?? "Holiday package",
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
