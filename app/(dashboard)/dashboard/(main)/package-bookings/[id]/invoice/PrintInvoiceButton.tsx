"use client";

/** Print / Save-as-PDF trigger — hidden when printing (parent uses `.no-print`).
 * Local copy rather than importing the website's PrintButton (app/(website)/bookings/[id]/PrintButton.tsx)
 * since that one pulls in the website's Button component/styling — this dashboard
 * invoice is a standalone printable document, not a themed dashboard panel. */
export default function PrintInvoiceButton() {
    return (
        <div className="no-print mt-6 flex justify-center">
            <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors cursor-pointer"
            >
                Print / Download PDF
            </button>
        </div>
    );
}
