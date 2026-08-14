"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * Print / Save-as-PDF, plus the way back to the editor.
 *
 * A hand-raised document is read back on this page to check it before it goes
 * out, so unlike the booking invoice's print button this one has to offer a
 * route to fix what you just spotted. Carries `.no-print` — the page chrome
 * hides it in the printed output.
 */
export default function PrintDocumentButton({ backHref }: { backHref: string }) {
    return (
        <div className="no-print mt-6 flex items-center justify-center gap-3">
            <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
            >
                <ArrowLeft className="size-4" />
                Back to editor
            </Link>
            <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
                <Printer className="size-4" />
                Print / Download PDF
            </button>
        </div>
    );
}
