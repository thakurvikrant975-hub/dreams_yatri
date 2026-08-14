import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import {
    ManualInvoicePayloadSchema,
    ManualVoucherPayloadSchema,
    EMPTY_INVOICE_DRAFT,
    EMPTY_VOUCHER_PAYLOAD,
    invoicePayloadToDraft,
    toDayString,
} from "@/app/lib/manual-documents";
import DocumentEditor, { type EditorInitial } from "../DocumentEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Edit document - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function EditManualDocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const record = await db.manualDocument.findUnique({ where: { id } });
    if (!record) notFound();

    const isInvoice = record.type === "INVOICE";

    // Parsed rather than cast. The payload is JSON on a row that may predate a
    // field, and the schema's defaults are what let an older document open in a
    // newer form instead of crashing it.
    const initial: EditorInitial = {
        header: {
            issueDate: toDayString(record.issueDate),
            guestName: record.guestName,
            guestContact: record.guestContact ?? "",
            title: record.title,
            startDate: toDayString(record.startDate),
            endDate: toDayString(record.endDate),
            travellers: record.travellers,
            notes: record.notes ?? "",
        },
        invoice: isInvoice
            ? invoicePayloadToDraft(ManualInvoicePayloadSchema.parse(record.payload))
            : structuredClone(EMPTY_INVOICE_DRAFT),
        voucher: isInvoice
            ? structuredClone(EMPTY_VOUCHER_PAYLOAD)
            : ManualVoucherPayloadSchema.parse(record.payload),
    };

    return (
        <DocumentEditor
            id={record.id}
            type={record.type}
            documentNumber={record.documentNumber}
            initial={initial}
        />
    );
}
