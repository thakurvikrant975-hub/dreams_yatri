import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import { formatPaise } from '@/app/lib/money';
import PrintButton from '../PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invoice | Dreams Yatri', robots: { index: false, follow: false } };

function fmtDate(d: Date | null): string {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user?.id) notFound();

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, userId: true, bookingNumber: true, createdAt: true, startDate: true, endDate: true, travellers: true,
            totalAmount_paise: true, priceSnapshot: true,
            package: { select: { title: true } },
            user: { select: { name: true, email: true } },
            payments: { select: { amount_paise: true, method: true, status: true, paidAt: true, createdAt: true, purpose: true }, orderBy: { createdAt: 'asc' } },
        },
    });
    if (!booking || booking.userId !== user.id) notFound();

    const total = booking.totalAmount_paise;
    const gstPct = (booking.priceSnapshot as { gst_percentage?: number } | null)?.gst_percentage ?? 0;
    const taxable = gstPct > 0 ? Math.round(total / (1 + gstPct / 100)) : total;
    const gst = total - taxable;
    const paid = booking.payments.filter((p) => p.status === 'FULLY_PAID').reduce((s, p) => s + p.amount_paise, 0);
    const balance = Math.max(0, total - paid);

    return (
        <main className="mx-auto max-w-2xl px-6 py-10 print:py-0 text-neutral-900">
            <style>{`@media print { .no-print { display:none !important } @page { margin: 16mm } }`}</style>

            <div className="flex items-start justify-between border-b border-neutral-200 pb-5">
                <div>
                    <div className="text-lg font-bold text-primary">Dreams Yatri</div>
                    <div className="text-xs text-neutral-500">Tax Invoice / Receipt</div>
                </div>
                <div className="text-right text-sm">
                    <div className="font-semibold">INV-{booking.bookingNumber}</div>
                    <div className="text-neutral-500">{fmtDate(booking.createdAt)}</div>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <div className="text-xs uppercase tracking-wide text-neutral-500">Billed to</div>
                    <div className="mt-1 font-medium">{booking.user?.name ?? 'Customer'}</div>
                    <div className="text-neutral-500">{booking.user?.email ?? ''}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-neutral-500">Booking</div>
                    <div className="mt-1 font-medium">{booking.bookingNumber}</div>
                    <div className="text-neutral-500">{fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}</div>
                </div>
            </div>

            <table className="mt-6 w-full text-sm border-collapse">
                <thead>
                    <tr className="border-y border-neutral-200 text-left text-neutral-500">
                        <th className="py-2 font-medium">Description</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-neutral-100">
                        <td className="py-2.5">{booking.package?.title ?? 'Holiday package'} — {booking.travellers} traveller{booking.travellers !== 1 ? 's' : ''}</td>
                        <td className="py-2.5 text-right">{formatPaise(taxable)}</td>
                    </tr>
                    {gst > 0 && (
                        <tr className="border-b border-neutral-100">
                            <td className="py-2.5">GST ({gstPct}%)</td>
                            <td className="py-2.5 text-right">{formatPaise(gst)}</td>
                        </tr>
                    )}
                    <tr className="border-b border-neutral-200 font-semibold">
                        <td className="py-2.5">Total</td>
                        <td className="py-2.5 text-right">{formatPaise(total)}</td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-6">
                <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Payments</div>
                <table className="w-full text-sm border-collapse">
                    <tbody>
                        {booking.payments.filter((p) => p.status === 'FULLY_PAID').map((p, i) => (
                            <tr key={i} className="border-b border-neutral-100">
                                <td className="py-2">{fmtDate(p.paidAt ?? p.createdAt)} · {p.method ?? '—'}{p.purpose === 'TOPUP' ? ' (date-change)' : ''}</td>
                                <td className="py-2 text-right">{formatPaise(p.amount_paise)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-5 ml-auto w-56 text-sm">
                <div className="flex justify-between py-1"><span className="text-neutral-500">Amount paid</span><span className="font-medium">{formatPaise(paid)}</span></div>
                <div className="flex justify-between py-1 border-t border-neutral-200"><span className="text-neutral-500">Balance due</span><span className="font-semibold">{formatPaise(balance)}</span></div>
            </div>

            <p className="mt-8 text-xs text-neutral-400 text-center">This is a computer-generated invoice and does not require a signature.</p>

            <PrintButton label="Print / Save invoice as PDF" />
        </main>
    );
}
