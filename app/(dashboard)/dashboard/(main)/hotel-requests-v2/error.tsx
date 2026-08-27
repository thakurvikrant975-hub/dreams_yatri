"use client";

// Scoped error boundary for the hotel-request queue and its fill pages.
//
// (main)/error.tsx already covers this route, but it offers "Try again" and
// "Go to dashboard" — and for the hotel team the dashboard is not where they
// were. A crash mid-fill cost them a reload plus a re-navigation back into the
// queue from the sidebar, every time. This one keeps the recovery local: retry
// in place, or step back to the queue, which is where the next request is.
//
// It also stops a render error in this subtree ever reaching the unstyled
// global-error page (the blank white screen), because it can catch it first.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function HotelRequestsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[hotel-requests-v2]", error);
    }, [error]);

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border-2 border-red-200 bg-red-50">
                <AlertTriangle className="size-6 text-red-500" />
            </div>

            <div className="max-w-sm space-y-2">
                <h1 className="text-lg font-semibold text-dashboard-base-content">
                    This hotel request page hit a problem
                </h1>
                <p className="text-sm text-dashboard-neutral leading-relaxed">
                    Any hotel you already submitted has been saved — filling one is a
                    single step, so nothing is half-written. Try again, or go back to
                    the queue and reopen the package.
                </p>
                {error.digest && (
                    <p className="rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 px-3 py-2 text-[11px] font-mono text-dashboard-neutral">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2.5">
                <button
                    onClick={reset}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-dashboard-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-dashboard-primary/90 transition-colors"
                >
                    <RefreshCw className="size-3.5" />
                    Try again
                </button>
                <Link
                    href="/dashboard/hotel-requests-v2"
                    className="inline-flex items-center gap-2 rounded-lg border border-dashboard-base-300 px-5 py-2.5 text-sm font-medium text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors"
                >
                    <ArrowLeft className="size-3.5" />
                    Back to Hotel Requests
                </Link>
            </div>
        </div>
    );
}
