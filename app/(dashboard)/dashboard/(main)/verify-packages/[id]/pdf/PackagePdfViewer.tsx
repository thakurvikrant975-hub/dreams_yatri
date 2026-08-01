"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { ItineraryDocument, type PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { captureToPdfPages, buildPdf } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/pdfExport";
import { getPackagePdfPreviewData } from "./actions";

export function PackagePdfViewer({ packageId }: { packageId: string }) {
    const captureRef = useRef<HTMLDivElement>(null);
    const [form, setForm] = useState<PreviewData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getPackagePdfPreviewData(packageId).then((data) => {
            if (cancelled) return;
            setError(null);
            if (!data) {
                setError("This package isn't ready for review yet.");
                return;
            }
            setForm(data);
        }).catch((e) => {
            if (cancelled) return;
            console.error(e);
            setError("Couldn't load this package.");
        });
        return () => { cancelled = true; };
    }, [packageId, attempt]);

    // Once the off-screen document has actually rendered (i.e. `form` is
    // set and the ref is mounted), capture it to a PDF and hand the whole
    // tab over to the browser's native PDF viewer — this route exists
    // specifically so a reviewer without Package Builder access sees just
    // the PDF, not the builder UI around it.
    useEffect(() => {
        if (!form) return;
        let cancelled = false;
        (async () => {
            const root = captureRef.current?.querySelector<HTMLElement>(".itinerary-print-area");
            if (!root) {
                if (!cancelled) setError("Couldn't find the itinerary content to export");
                return;
            }
            try {
                const { pages } = await captureToPdfPages(root);
                if (cancelled) return;
                const pdf = buildPdf(pages);
                const blobUrl = URL.createObjectURL(pdf.output("blob"));
                window.location.replace(blobUrl);
            } catch (e) {
                if (cancelled) return;
                console.error(e);
                setError("Failed to generate the PDF. If a hotel/activity photo is hosted somewhere without CORS enabled, it may be blocking the capture.");
            }
        })();
        return () => { cancelled = true; };
    }, [form]);

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-100 px-6 text-center">
            {error ? (
                <>
                    <AlertCircle className="size-6 text-red-500" />
                    <p className="text-sm text-neutral-700">{error}</p>
                    <div className="flex items-center gap-3 mt-1">
                        <button
                            type="button"
                            onClick={() => setAttempt((n) => n + 1)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-dashboard-primary hover:underline"
                        >
                            <RotateCcw className="size-3.5" /> Try again
                        </button>
                        <Link href="/dashboard/verify-packages" className="text-sm text-neutral-500 hover:underline">
                            Back to Verify Packages
                        </Link>
                    </div>
                </>
            ) : (
                <>
                    <Loader2 className="size-6 animate-spin text-dashboard-primary" />
                    <p className="text-sm text-neutral-500">Generating PDF…</p>
                </>
            )}

            {/* Off-screen capture source, same technique as ItineraryPdfExport —
               a read-only render (no onImageChange/onCoverImageChange passed)
               at a fixed 210mm width so html2canvas measures a consistent,
               print-accurate layout. */}
            {form && (
                <div
                    ref={captureRef}
                    aria-hidden
                    style={{ position: "fixed", top: 0, left: "-10000px", width: "210mm" }}
                >
                    <ItineraryDocument form={form} variant="flat" />
                </div>
            )}
        </div>
    );
}
