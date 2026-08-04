import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVoucherData } from "@/app/lib/voucher";
import VoucherDocument from "@/app/components/voucher/VoucherDocument";
import PrintVoucherButton from "./PrintVoucherButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Booking voucher - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * Ops view of the voucher. The document itself lives in
 * app/components/voucher/VoucherDocument.tsx and is shared with the guest route
 * (/bookings/[id]/voucher) — ops needs to see exactly what the guest was sent,
 * not a parallel rendering of the same booking.
 */
export default async function BookingVoucherPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const data = await getVoucherData(id);
    if (!data) notFound();

    return <VoucherDocument data={data} actions={<PrintVoucherButton />} />;
}
