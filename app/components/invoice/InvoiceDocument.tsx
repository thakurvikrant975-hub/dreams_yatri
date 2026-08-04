import DyLogo from "@/app/components/ui/DyLogo";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { buildInvoiceViewModel, type InvoiceBookingData } from "@/app/lib/invoice";

// The one invoice layout — dashboard admins and customers must see identical
// figures and design for the same booking, so both render THIS component
// rather than keeping their own copies that can drift apart.

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export default function InvoiceDocument({ booking }: { booking: InvoiceBookingData }) {
    const v = buildInvoiceViewModel(booking);

    return (
        <div className="mx-auto max-w-215 bg-white shadow-lg print:shadow-none rounded-sm overflow-hidden">
            {/* ── Header ── */}
            <div className="flex items-start justify-between px-10 pt-10 pb-6">
                <div>
                    <DyLogo className="h-11.5 text-primary-500" />
                    <div className="mt-1.5 text-[11px] text-neutral-600/90">Curated Holiday Experiences</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold tracking-[0.15em] text-neutral-700">INVOICE</div>
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
                    <div>support@dreamsyatri.com</div>
                    <div>+91 82199 79481</div>
                </div>
            </div>

            {/* ── Line items ── */}
            <div className="px-10">
                <div className="rounded-lg ring-[0.1em] ring-inset ring-neutral-300/80 overflow-hidden p-[0.1em] bg-white">
                    <table className="w-full text-sm border-collapse rounded-md overflow-hidden">
                        <thead>
                            <tr className="bg-primary-500 text-white">
                                <th className="text-left font-semibold px-3 py-2.5">Description</th>
                                <th className="text-right font-semibold px-3 py-2.5">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="px-3 py-3 align-top text-neutral-800">
                                    {v.lineItemLabel}
                                    {v.lineItemDetail && (
                                        <span className="block text-xs text-neutral-600/90 mt-0.5">{v.lineItemDetail}</span>
                                    )}
                                </td>
                                <td className="px-3 py-3 align-top text-right text-neutral-800">{formatPaiseRoundedUp(v.taxable)}</td>
                            </tr>
                            {v.gst > 0 && (
                                <tr className="bg-neutral-50">
                                    <td className="px-3 py-3 align-top text-neutral-700">GST ({v.gstPct}%)</td>
                                    <td className="px-3 py-3 align-top text-right text-neutral-700">{formatPaiseRoundedUp(v.gst)}</td>
                                </tr>
                            )}
                            <tr className="border-t-2 border-neutral-200 font-semibold">
                                <td className="px-3 py-3 text-neutral-900">Total</td>
                                <td className="px-3 py-3 text-right text-neutral-900">{formatPaiseRoundedUp(v.total)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Payments ── */}
            <div className="px-10 mt-8">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-700">Payments</div>
                <div className="rounded-lg ring-[0.1em] ring-inset ring-neutral-300/80 overflow-hidden p-[0.1em] bg-white">
                    <table className="w-full text-sm border-collapse rounded-md overflow-hidden">
                        <tbody>
                            {v.paidPayments.length === 0 ? (
                                <tr><td className="px-3 py-4 text-center text-neutral-600/90 text-xs">No payments recorded yet</td></tr>
                            ) : v.paidPayments.map((p, i) => (
                                <tr key={i} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                                    <td className="px-3 py-2.5 text-neutral-600/90">{fmtDate(p.date)} · {p.label}</td>
                                    <td className="px-3 py-2.5 text-right text-neutral-700">{formatPaiseRoundedUp(p.amount_paise)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Totals ── */}
            <div className="px-10 mt-5 flex justify-end">
                <div className="w-64 text-sm">
                    <div className="flex justify-between py-1"><span className="text-neutral-600/90">Amount paid</span><span className="font-medium text-neutral-900">{formatPaiseRoundedUp(v.paid)}</span></div>
                    <div className="flex justify-between py-1 border-t border-neutral-200"><span className="text-neutral-600/90">Balance due</span><span className="font-semibold text-neutral-900">{formatPaiseRoundedUp(v.balance)}</span></div>
                </div>
            </div>

            {/* ── Footer ── */}
            <p className="px-10 mt-8 text-xs text-neutral-600/90 text-center">This is a computer-generated invoice and does not require a signature.</p>

            <div className="mt-8 border-t border-neutral-200 px-10 py-5 flex items-center justify-between text-[11px] text-neutral-600/90">
                <span>support@dreamsyatri.com · +91 82199 79481</span>
                <DyLogo className="h-4 text-primary-500" />
            </div>
        </div>
    );
}
