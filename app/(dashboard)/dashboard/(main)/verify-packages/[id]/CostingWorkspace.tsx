"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The itinerary document, inside the costing review.
//
// The same document the exec builds and the client receives — not a summary of
// it. A costing manager reviewing a table of line items is reviewing an
// abstraction and has to imagine the trip behind it; reviewing the actual page
// means the hotel, the room, the cab and the day it sits on are all in front of
// them while they check the number.
//
// Loaded client-side rather than on the server: the page already does a lot of
// pricing work before it can render, and the document is the one part of the
// screen a reviewer can wait a moment for. The breakdown beside it appears
// immediately and is unaffected if this fails.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Loader2, FileText, ChevronDown } from "lucide-react";
import { ItineraryDocument, type PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { getPackagePdfPreviewData } from "./pdf/actions";

export function CostingDocument({ packageId }: { packageId: string }) {
  const [form, setForm] = useState<PreviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(true);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPackagePdfPreviewData(packageId)
      .then((data) => { if (!cancelled) { if (data) setForm(data); else setFailed(true); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [packageId]);

  return (
    <div className="rounded-lg border border-dashboard-base-300 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-dashboard-base-300 hover:bg-dashboard-base-200/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-dashboard-neutral" />
          <span className="text-sm font-semibold text-dashboard-base-content">Itinerary</span>
          <span className="text-[11px] text-dashboard-neutral">what the client will receive</span>
        </span>
        <ChevronDown className={`size-4 text-dashboard-neutral transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div ref={shellRef} className="bg-dashboard-base-200/40 p-4 max-h-[70vh] overflow-auto">
          {form ? (
            // The document is a fixed 210mm and this column is not, so it is
            // scaled to fit. The negative margin reclaims the space the
            // transform leaves behind — a CSS transform doesn't change layout
            // size, so without it the card keeps the full unscaled height and
            // ends in a long blank gap.
            <div className="origin-top mx-auto w-[210mm]" style={{ transform: "scale(0.62)", marginBottom: "-38%" }}>
              <ItineraryDocument form={form} variant="flat" />
            </div>
          ) : failed ? (
            <p className="py-12 text-center text-xs text-dashboard-neutral">
              Couldn&apos;t load the itinerary. The pricing below is unaffected.
            </p>
          ) : (
            <div className="py-12 flex flex-col items-center gap-2 text-dashboard-neutral">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs">Loading the itinerary…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
