import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import InvoiceDocument from '@/app/components/invoice/InvoiceDocument';
import { INVOICE_BOOKING_SELECT } from '@/app/lib/invoice';
import PrintButton from '../PrintButton';
import AutoPrint from './AutoPrint';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invoice | Dreams Yatri', robots: { index: false, follow: false } };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { id } = await params;
    const sp = await searchParams;
    const autoPrint = sp.download === '1';
    const user = await getAuthenticatedUser();
    if (!user?.id) notFound();

    const booking = await db.booking.findUnique({
        where: { id },
        select: { userId: true, ...INVOICE_BOOKING_SELECT },
    });
    if (!booking || booking.userId !== user.id) notFound();

    return (
        <main className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
            {autoPrint && <AutoPrint />}
            <style>{`@media print { .no-print { display:none !important } @page { margin: 12mm } }`}</style>
            <InvoiceDocument booking={booking} />
            <PrintButton label="Print / Save invoice as PDF" />
        </main>
    );
}
