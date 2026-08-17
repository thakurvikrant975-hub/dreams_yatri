"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The itinerary the sales exec actually designed, served as a live web page.
//
// Until now the package builder's document had exactly one way out of the
// building: a PDF. The client's share link went to a separately-built website
// page (CustomPackageHero + tabs + pricing card) that showed the same *data* in
// a different design — so the template the exec chose, themed and laid out and
// signed off on, was never the thing the client opened. This renders that
// document itself, with `published` set so it drops every builder affordance
// and uses the same export-only fallbacks the PDF does.
//
// The document is a fixed 210mm-wide A4 page by construction (it has to be —
// it's the PDF's own DOM), so the only honest way to put it on a phone is to
// scale it to the viewport and let the reader pinch-zoom, the way a browser
// shows a PDF. That's what the scaler below does: measure the space we have,
// measure the page's natural size, scale down to fit (never up), and reserve
// exactly the scaled height so nothing below it floats in dead space.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Printer } from "lucide-react";
import { ItineraryDocument, type PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder-v2/[packageId]/ItineraryDocument";
import { stayOptionLabel } from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options";
import { useBookCustomPackage } from "./useBookCustomPackage";

/** Undoes the scaler for window.print(): the document's own PRINT_STYLES
 * already lay the page out at a true 210mm and hide everything around it, and
 * a CSS transform left on an ancestor would shrink that back down and print a
 * half-size page in the corner of the sheet. */
const PUBLISHED_STYLES = `
  @media print {
    .published-doc-fit { width: auto !important; height: auto !important; }
    .published-doc-scaler { transform: none !important; }
  }
`;

export function PublishedItinerary({ form, packageId }: { form: PreviewData; packageId: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  // null until measured — the document renders at its full 210mm for one
  // frame otherwise, which on a phone is a visible lurch sideways.
  const [box, setBox] = useState<{ scale: number; width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const scaler = scalerRef.current;
    if (!frame || !scaler) return;
    // offsetWidth/Height are pre-transform, so these stay the page's natural
    // A4 size no matter what scale is currently applied — measuring the
    // scaled result instead would feed the scale back into itself.
    const naturalWidth = scaler.offsetWidth;
    const naturalHeight = scaler.offsetHeight;
    if (!naturalWidth || !naturalHeight) return;
    // Never scale up: on a wide desktop the page sits at 100%, the same size
    // it prints at, rather than being blown up into a soft, oversized poster.
    const scale = Math.min(1, frame.clientWidth / naturalWidth);
    setBox((prev) =>
      prev && prev.scale === scale && prev.height === naturalHeight && prev.width === naturalWidth
        ? prev
        : { scale, width: naturalWidth, height: naturalHeight },
    );
  }, []);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const frame = frameRef.current;
    const scaler = scalerRef.current;
    if (!frame || !scaler) return;
    // Both ends move: the frame on viewport resize / orientation change, and
    // the document itself as photos finish loading and push it taller. A
    // height change that isn't picked up leaves the footer overlapping the
    // page or a band of empty space under it.
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(scaler);
    return () => ro.disconnect();
  }, [measure]);

  // Late-loading images inside the document don't always resize the observed
  // box in a way ResizeObserver reports before layout settles, so re-measure
  // once everything on the page has loaded too.
  useEffect(() => {
    if (document.readyState === "complete") return;
    window.addEventListener("load", measure);
    return () => window.removeEventListener("load", measure);
  }, [measure]);

  return (
    <>
      <style>{PUBLISHED_STYLES}</style>

      <div ref={frameRef} className="w-full flex justify-center">
        {/* Reserves the scaled footprint. The scaled child is transformed, so
            it no longer occupies its own layout box — without this the page
            would collapse to nothing and the site footer would ride up over
            the itinerary. */}
        <div
          className="published-doc-fit"
          style={box ? { width: box.width * box.scale, height: box.height * box.scale } : undefined}
        >
          <div
            ref={scalerRef}
            className="published-doc-scaler w-fit"
            style={{
              transform: box ? `scale(${box.scale})` : undefined,
              transformOrigin: "top left",
              // Hidden rather than unmounted for the first frame: it has to be
              // in the DOM at full size to be measurable at all.
              visibility: box ? undefined : "hidden",
            }}
          >
            <ItineraryDocument form={form} published />
          </div>
        </div>
      </div>

      <BookingBar form={form} packageId={packageId} />
    </>
  );
}

/** The one thing the document can't carry: a way to actually book it. Sticky
 * at the bottom on every size — the document is long, and the client reaching
 * the end of day 6 shouldn't have to scroll back up to act on it. */
function BookingBar({ form, packageId }: { form: PreviewData; packageId: string }) {
  const { handleBookNow, submitting, error } = useBookCustomPackage(packageId);
  const totalPax = form.adults + form.children;
  const priceStr = form.totalPrice
    ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}`
    : "To be confirmed";

  // Which stay option this bar's price and Book Now actually refer to. The
  // document above may be showing three, and the booking flow can currently
  // only create the default one — so the bar has to say which, rather than
  // letting someone who just read a 4★ row assume that is what they are
  // paying for. Absent entirely on a single-option package.
  const options = form.stayOptions ?? [];
  const bookingTier = options.length > 1
    ? stayOptionLabel(options.find((o) => o.isDefault) ?? options[0])
    : null;

  return (
    <div className="no-print sticky bottom-0 z-50 mt-6 border-t border-neutral-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold tracking-tight text-primary-500 truncate">{priceStr}</p>
          <p className="text-xs text-neutral-500">
            Total for {totalPax} traveller{totalPax !== 1 ? "s" : ""}
            {bookingTier && <> · <span className="font-medium text-neutral-700">{bookingTier}</span></>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The browser's own "Save as PDF" is right here in its print dialog,
              and the document's PRINT_STYLES already produce the exact A4 the
              exec exports — so the client gets the PDF without this page
              shipping the html2canvas/jsPDF exporter to every visitor. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Save as PDF</span>
          </button>

          {form.totalPrice ? (
            <button
              type="button"
              onClick={handleBookNow}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
            >
              {submitting
                ? <Loader2 size={14} className="animate-spin" />
                : <>Book {bookingTier ?? "Now"} <ArrowRight size={14} /></>}
            </button>
          ) : null}
        </div>
      </div>

      {bookingTier && (
        <p className="mx-auto max-w-3xl pt-1.5 text-[11px] text-neutral-500">
          Booking online charges the {bookingTier} option shown above. To take one of the
          other standards, message your travel manager and they will send it across.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
