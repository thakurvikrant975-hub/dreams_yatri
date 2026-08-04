import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import { getVoucherData } from '@/app/lib/voucher';
import VoucherDocument from '@/app/components/voucher/VoucherDocument';
import PrintButton from '../PrintButton';
import AutoPrint from '../invoice/AutoPrint';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Trip voucher | Dreams Yatri', robots: { index: false, follow: false } };

/**
 * The guest's own copy. Identical document to the ops voucher — a guest quoting
 * their voucher at check-in and the ops person reading it back must be looking
 * at the same page.
 *
 * `?download=1` opens straight into the print dialog, matching the invoice, so
 * "Download voucher" from an email or the profile is one click to a PDF.
 */
export default async function VoucherPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ download?: string }>;
}) {
    const { id } = await params;
    const { download } = await searchParams;

    const user = await getAuthenticatedUser();
    if (!user?.id) notFound();

    // Ownership is checked before anything is loaded — a voucher carries the
    // guest's name, contact and full itinerary.
    const owner = await db.booking.findUnique({ where: { id }, select: { userId: true } });
    if (!owner || owner.userId !== user.id) notFound();

    const data = await getVoucherData(id);
    if (!data) notFound();

    return (
        <VoucherDocument
            data={data}
            actions={download === '1' ? <AutoPrint /> : <PrintButton label="Print / Save voucher as PDF" />}
        />
    );
}
