import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import InvoiceDocument from "@/app/components/invoice/InvoiceDocument";
import PrintInvoiceButton from "./PrintInvoiceButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Booking invoice - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function BookingInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            bookingNumber: true, createdAt: true, startDate: true, endDate: true, travellers: true,
            totalAmount_paise: true, priceSnapshot: true, contactEmail: true, contactPhone: true, gstStateCode: true,
            package: { select: { title: true } },
            destination: { select: { name: true } },
            user: { select: { name: true, email: true } },
            payments: { select: { amount_paise: true, method: true, status: true, paidAt: true, createdAt: true, purpose: true }, orderBy: { createdAt: "asc" } },
        },
    });
    if (!booking) notFound();

    return (
        <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
            <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>
            <InvoiceDocument booking={booking} />
            <PrintInvoiceButton />
        </div>
    );
}
