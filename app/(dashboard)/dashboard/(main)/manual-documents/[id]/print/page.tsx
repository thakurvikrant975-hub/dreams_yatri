import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import InvoiceDocument from "@/app/components/invoice/InvoiceDocument";
import VoucherDocument from "@/app/components/voucher/VoucherDocument";
import {
    ManualInvoicePayloadSchema,
    ManualVoucherPayloadSchema,
    manualInvoiceToDocument,
    manualVoucherToDocument,
} from "@/app/lib/manual-documents";
import PrintDocumentButton from "../../PrintDocumentButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Document - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * The finished, printable document.
 *
 * Renders the SAME InvoiceDocument / VoucherDocument components the booking
 * routes use — a hand-raised invoice and a generated one are the same piece of
 * paper, and the only way to keep them that way is for neither to own a copy of
 * the layout. Everything this route does is turn the stored payload back into
 * the model those components expect.
 */
export default async function ManualDocumentPrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const record = await db.manualDocument.findUnique({ where: { id } });
    if (!record) notFound();

    if (record.type === "INVOICE") {
        // Parsed rather than cast: the payload is JSON on a row that may have
        // been written before a field existed, and the schema's defaults are what
        // make an older document still render.
        const payload = ManualInvoicePayloadSchema.parse(record.payload);
        return (
            <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
                <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>
                <InvoiceDocument document={manualInvoiceToDocument(record, payload)} />
                <PrintDocumentButton backHref={`/dashboard/manual-documents/${id}`} />
            </div>
        );
    }

    const payload = ManualVoucherPayloadSchema.parse(record.payload);
    return (
        <VoucherDocument
            data={manualVoucherToDocument(record, payload)}
            actions={<PrintDocumentButton backHref={`/dashboard/manual-documents/${id}`} />}
        />
    );
}
