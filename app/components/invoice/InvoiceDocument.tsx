import DyLogo from "@/app/components/ui/DyLogo";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { buildInvoiceViewModel, type InvoiceBookingData } from "@/app/lib/invoice";
import { COMPANY } from "@/app/lib/company";

// The one invoice layout — dashboard admins and customers must see identical
// figures and design for the same booking, so both render THIS component
// rather than keeping their own copies that can drift apart.

/** Grid lines, matching the voucher's tables: a neutral rule in the body and a
 *  lighter primary one inside the header, where the fill is already primary. */
const CELL_BORDER = "border border-neutral-200/80";
const HEAD_BORDER = "border border-primary-300/70";

/** Same chrome as the voucher's TableFrame, so an invoice and a voucher for the
 *  same booking read as two pages of one document set. */
function TableFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="p-[0.1em] bg-white">
            <table className="w-full text-sm border-collapse">{children}</table>
        </div>
    );
}

/** Invoice-only — the voucher is an operational document and carries none of
 *  these. The closing line is deliberately last, after the conditions. */
const TERMS = [
    "Subject to Shimla jurisdiction.",
    "Subject to realization of Cheque.",
    "Without original Receipt no refund is permissible.",
    "Kindly check all details carefully to avoid un-necessary complications.",
    "Thank you for doing business with us.",
];

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export default function InvoiceDocument({ booking }: { booking: InvoiceBookingData }) {
    const v = buildInvoiceViewModel(booking);

    return (
        <div className="invoice-page mx-auto max-w-215 bg-white shadow-lg print:shadow-none rounded-sm overflow-hidden">
            {/* Chrome drops backgrounds when printing unless told otherwise,
                which strips the header fills and zebra rows from the saved PDF.
                Lives here rather than in the routes so all three surfaces that
                render an invoice get it. */}
            <style>{`
                .invoice-page, .invoice-page * {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @media print {
                    .invoice-page { border-radius: 0 !important; }
                    .invoice-page thead { display: table-header-group; }
                    .invoice-page tr { break-inside: avoid; }
                }
            `}</style>

            {/* ── Header ── */}
            <div className="flex items-start justify-between px-10 pt-10 pb-6">
                {/* Address in place of the tagline, not under it — this header sits
                    above the GSTIN/CIN block and a third line makes it top-heavy. */}
                <div className="max-w-75">
                    <DyLogo className="h-11.5 text-primary-500" />
                    <div className="mt-1.5 text-[10px] leading-relaxed text-neutral-600/90">{COMPANY.address}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold tracking-[0.15em] text-neutral-700">INVOICE</div>
                    <div className="mt-1.5 text-[10px] leading-relaxed text-neutral-600/90">
                        <div>GSTIN: <span className="font-semibold text-neutral-800">{COMPANY.gstin}</span></div>
                        <div>CIN: <span className="font-semibold text-neutral-800">{COMPANY.cin}</span></div>
                    </div>
                </div>
            </div>
            <div className="h-0.75 bg-linear-to-r from-primary-600 to-primary-400" />

            {/* ── Meta row ── */}
            <div className="flex flex-wrap items-start justify-between gap-4 px-10 py-6 text-sm">
                <div className="flex gap-10">
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Invoice No.</div>
                        <div className="mt-0.5 font-semibold text-neutral-900">INV-{booking.bookingNumber}</div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Date</div>
                        <div className="mt-0.5 font-semibold text-neutral-900">{fmtDate(booking.createdAt)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Service</div>
                        <div className="mt-0.5 font-semibold text-neutral-900">{v.serviceType}</div>
                    </div>
                    {booking.gstStateCode && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">GST State</div>
                            <div className="mt-0.5 font-semibold text-neutral-900">{booking.gstStateCode}</div>
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Billed To</div>
                    <div className="mt-0.5 font-semibold text-neutral-900">{v.billedToName}</div>
                    <div className="text-xs text-neutral-800">{v.billedToContact}</div>
                </div>
            </div>

            {/* ── Trip summary strip ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-10 pb-6">
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Booking</div>
                    <div className="mt-0.5 text-lg font-bold text-neutral-900">{booking.bookingNumber}</div>
                    <div className="text-xs text-neutral-800 mt-0.5">
                        {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)} · {booking.travellers} traveller{booking.travellers !== 1 ? "s" : ""}
                    </div>
                </div>
                <div className="text-right text-xs text-neutral-800 leading-relaxed">
                    <div>{COMPANY.email}</div>
                    <div>{COMPANY.phone}</div>
                </div>
            </div>

            {/* ── Line items ── */}
            <div className="px-10">
                <TableFrame>
                    <thead className="print:table-header-group">
                        <tr className="bg-primary-500 text-white">
                            <th className={`text-left font-semibold px-3 py-2.5 ${HEAD_BORDER}`}>Description</th>
                            <th className={`text-right font-semibold px-3 py-2.5 ${HEAD_BORDER}`}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="break-inside-avoid">
                            <td className={`px-3 py-3 align-top text-neutral-800 ${CELL_BORDER}`}>
                                <span className="block text-[10px] uppercase tracking-wide text-neutral-500">{v.serviceType}</span>
                                {v.lineItemLabel}
                                {v.lineItemDetail && (
                                    <span className="block text-xs text-neutral-600/90 mt-0.5">{v.lineItemDetail}</span>
                                )}
                            </td>
                            <td className={`px-3 py-3 align-top text-right text-neutral-800 ${CELL_BORDER}`}>{formatPaiseRoundedUp(v.taxable)}</td>
                        </tr>
                        {v.gst > 0 && (
                            <tr className="bg-neutral-50 break-inside-avoid">
                                <td className={`px-3 py-3 align-top text-neutral-700 ${CELL_BORDER}`}>GST ({v.gstPct}%)</td>
                                <td className={`px-3 py-3 align-top text-right text-neutral-700 ${CELL_BORDER}`}>{formatPaiseRoundedUp(v.gst)}</td>
                            </tr>
                        )}
                        <tr className="font-semibold break-inside-avoid">
                            <td className={`px-3 py-3 text-neutral-900 ${CELL_BORDER}`}>Total</td>
                            <td className={`px-3 py-3 text-right text-neutral-900 ${CELL_BORDER}`}>{formatPaiseRoundedUp(v.total)}</td>
                        </tr>
                    </tbody>
                </TableFrame>
            </div>

            {/* ── Payments ── */}
            <div className="px-10 mt-8">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-700">Payments</div>
                <TableFrame>
                    <thead className="print:table-header-group">
                        <tr className="bg-primary-500 text-white">
                            <th className={`text-left font-semibold px-3 py-2.5 ${HEAD_BORDER}`}>Received</th>
                            <th className={`text-right font-semibold px-3 py-2.5 ${HEAD_BORDER}`}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {v.paidPayments.length === 0 ? (
                            <tr><td colSpan={2} className={`px-3 py-4 text-center text-neutral-600/90 text-xs ${CELL_BORDER}`}>No payments recorded yet</td></tr>
                        ) : v.paidPayments.map((p, i) => (
                            <tr key={i} className={`break-inside-avoid ${i % 2 === 1 ? "bg-neutral-50" : ""}`}>
                                <td className={`px-3 py-2.5 text-neutral-600/90 ${CELL_BORDER}`}>{fmtDate(p.date)} · {p.label}</td>
                                <td className={`px-3 py-2.5 text-right text-neutral-700 ${CELL_BORDER}`}>{formatPaiseRoundedUp(p.amount_paise)}</td>
                            </tr>
                        ))}
                    </tbody>
                </TableFrame>
            </div>

            {/* ── Totals ── */}
            <div className="px-10 mt-5 flex justify-end">
                <div className="w-64 text-sm">
                    <div className="flex justify-between py-1"><span className="text-neutral-600/90">Amount paid</span><span className="font-medium text-neutral-900">{formatPaiseRoundedUp(v.paid)}</span></div>
                    <div className="flex justify-between py-1 border-t border-neutral-200"><span className="text-neutral-600/90">Balance due</span><span className="font-semibold text-neutral-900">{formatPaiseRoundedUp(v.balance)}</span></div>
                </div>
            </div>

            {/* ── Terms & conditions ── */}
            <div className="px-10 mt-8 break-inside-avoid">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-700">Terms &amp; Conditions</div>
                <ol className="list-decimal pl-4 space-y-1">
                    {TERMS.map((term, i) => (
                        <li key={i} className="text-[11px] leading-relaxed text-neutral-700 break-inside-avoid">{term}</li>
                    ))}
                </ol>
            </div>

            {/* ── Footer ── */}
            <p className="px-10 mt-8 text-xs text-neutral-600/90 text-center">This is a computer-generated invoice and does not require a signature.</p>

            <div className="mt-8 border-t border-neutral-200 px-10 py-5 flex items-center justify-between text-[11px] text-neutral-600/90">
                <span>{COMPANY.email} · {COMPANY.phone}</span>
                <DyLogo className="h-4 text-primary-500" />
            </div>
        </div>
    );
}
