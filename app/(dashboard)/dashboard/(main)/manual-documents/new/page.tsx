import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Ticket } from "lucide-react";
import DocumentEditor, { emptyInitial } from "../DocumentEditor";

export const metadata: Metadata = {
    title: "New document - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * `?type=invoice|voucher` picks the form. Without it, the chooser — the two
 * documents are different enough (line items and GST versus an itinerary) that
 * one form with a toggle at the top would open on fields half of which are
 * wrong for what ops came here to do.
 */
export default async function NewManualDocumentPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const { type } = await searchParams;

    if (type === "invoice" || type === "voucher") {
        return (
            <DocumentEditor
                type={type === "invoice" ? "INVOICE" : "VOUCHER"}
                initial={emptyInitial()}
            />
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="text-lg font-semibold text-dashboard-base-content">Create a document</h1>
            <p className="mt-1 text-xs text-dashboard-base-content/55">
                Same invoice and voucher the system issues for online bookings, filled in by hand — for walk-ins,
                agents, and anything else that never became a booking.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ChoiceCard
                    href="/dashboard/manual-documents/new?type=invoice"
                    icon={<FileText className="size-5" />}
                    title="Invoice"
                    description="Itemised charges, GST, and payments received. Prints with the company GSTIN and the standard conditions."
                />
                <ChoiceCard
                    href="/dashboard/manual-documents/new?type=voucher"
                    icon={<Ticket className="size-5" />}
                    title="Voucher"
                    description="Day-by-day itinerary, hotels, transport, inclusions and policies — the document a guest presents at check-in."
                />
            </div>
        </div>
    );
}

function ChoiceCard({
    href,
    icon,
    title,
    description,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-5 transition-colors hover:border-dashboard-primary/40 hover:bg-dashboard-base-200/40"
        >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-dashboard-primary/10 text-dashboard-primary">
                {icon}
            </span>
            <h2 className="mt-3 text-sm font-semibold text-dashboard-base-content">{title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-dashboard-base-content/55">{description}</p>
        </Link>
    );
}
