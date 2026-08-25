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
// The document is a fixed 210mm-wide A4 page by construction — it is the PDF's
// own DOM. This route used to honour that literally, measuring the sheet and
// scaling it down to fit the viewport, which on a phone produced an A4 page
// shrunk to thumb size and a reader pinching at it. It was a PDF viewer built
// out of divs.
//
// It is a web page, so it is laid out as one: PRINT_STYLES lets the document
// take the width it is given whenever data-published is set and it is not
// being captured, and the two output paths keep the fixed column they need.
// Nothing here scales anything.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { ItineraryDocument, type PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder-v2/[packageId]/ItineraryDocument";
import SavingsBadge from "@/app/components/packages/SavingBadge";
import { useBookCustomPackage } from "./useBookCustomPackage";
import { PUBLISHED_THEME } from "./published-theme";

/** "12 Sep 2026" — the balance date, in the form a client reads rather than
 *  the ISO the engine returns. */
function formatDueDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PublishedItinerary({ form, packageId }: { form: PreviewData; packageId: string }) {
  return (
    <>
      {/* The website's own presentation of the document — its width, its
          measure, its type scale. Injected here rather than by the document,
          so the builder and both PDF exporters never load it and a change
          made for this page cannot reach them. */}
      <style>{PUBLISHED_THEME}</style>

      {/* No scaler any more.
          The document used to be a fixed 210mm sheet, so the only way to fit
          it on a phone was to measure it, scale it down and reserve the
          scaled footprint — a whole apparatus of refs, a ResizeObserver and a
          hidden first frame, all to make an A4 page legible on a 390px
          screen. It never really was: it produced a shrunk sheet the reader
          had to pinch at.
          The document now takes the width it is given on this route (see the
          data-published rules in PRINT_STYLES), so there is nothing left to
          scale. */}
      <div className="w-full">
        <ItineraryDocument form={form} published variant="page" />
      </div>

      <BookingBar form={form} packageId={packageId} />
    </>
  );
}

/** The one thing the document can't carry: a way to actually book it. Sticky
 * at the bottom on every size — the document is long, and the client reaching
 * the end of day 6 shouldn't have to scroll back up to act on it. */
function BookingBar({ form, packageId }: { form: PreviewData; packageId: string }) {
  // The options, and which one the client is buying. Starts on the recommended
  // one — the stay the document's columns badge — so a client who never touches
  // this books exactly what they read.
  const options = form.stayOptions ?? [];
  const multi = options.length > 1;
  const [chosenId, setChosenId] = useState<string | null>(
    multi ? (options.find((o) => o.isRecommended) ?? options[0]).id : null,
  );
  const chosen = options.find((o) => o.id === chosenId) ?? null;

  const { handleBookNow, submitting, error } = useBookCustomPackage(packageId, chosenId);
  // Only meaningful against the package's own total. A client who has picked a
  // different standard is being quoted that column's price, and the deposit
  // for it is not this one — so it is withheld rather than shown wrong.
  // Both the deposit and the discount describe the PACKAGE's own total. A
  // client who has switched to another standard is being quoted that column's
  // price, and neither figure was computed against it — so both are withheld
  // rather than shown against a number they do not belong to.
  const onPackagePrice = !(multi && chosen && chosen.id !== options.find((o) => o.isRecommended)?.id);
  const deposit = onPackagePrice ? form.bookingDeposit ?? null : null;
  const discount = onPackagePrice ? form.discount ?? null : null;
  const totalPax = form.adults + form.children;

  // The chosen option's price leads once there is a choice, because that is the
  // number this button is about to charge. Falls back to the package's own,
  // which is all a single-stay package has.
  const priceValue = chosen?.totalPrice ?? (form.totalPrice ? Number(form.totalPrice) : null);
  const priceStr = priceValue
    ? `${form.currency} ${priceValue.toLocaleString("en-IN")}`
    : "To be confirmed";

  return (
    <div className="no-print sticky bottom-0 z-50 mt-6 border-t border-neutral-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      {multi && (
        <div className="mx-auto w-full max-w-4xl pb-2 flex flex-wrap items-center gap-1.5">
          {options.map((o) => {
            const on = o.id === chosenId;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setChosenId(o.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on
                    ? "border-primary-500 bg-primary-50 font-semibold text-primary-600"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  }`}
              >
                {o.label}
                {o.isRecommended && <span className="ml-1 text-[10px] opacity-70">recommended</span>}
                {o.totalPrice != null && (
                  <span className="ml-1.5 tabular-nums opacity-80">
                    {form.currency} {Math.round(o.totalPrice).toLocaleString("en-IN")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* max-w-6xl, the same measure the document's sections land at, so the
          price and the Book button sit under the content rather than adrift of
          it. Written plainly rather than through the document's custom
          property: this bar is outside the document, so none of the zoom
          compensation that property is divided by applies to it. */}
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <div className="min-w-0 flex-1 flex items-center justify-between">
          <div>
            {/* What it was, then what it is. The struck figure alone reads as a
              correction — the green saving beside it is what says a concession
              was made, which is the part a client repeats to whoever else is
              deciding with them. */}
          <p className="flex items-baseline gap-2 truncate">
            {discount && (
              <span className="text-sm text-neutral-400 line-through tabular-nums shrink-0">
                {form.currency} {Math.round(discount.originalPrice).toLocaleString("en-IN")}
              </span>
            )}
            <span className="font-heading text-lg font-bold tracking-tight text-primary-500">{priceStr}</span>
            {discount && (
              // The same badge the document's price panel uses, so the saving
              // looks like one thing in both places. Its serrated edges are
              // absolutely positioned outside the box, hence the margin — the
              // flex gap alone would clip them against the price.
              <SavingsBadge amount={discount.label} prefix="" className="shrink-0 mx-1.5" />
            )}
          </p>
            <p className="text-xs text-neutral-500">
              Total for {totalPax} traveller{totalPax !== 1 ? "s" : ""}
              {chosen && multi && <> · <span className="font-medium text-neutral-700">{chosen.label}</span></>}
            </p>
          </div>
          {/* What it actually takes to hold this, on the line under the total.
              A client reading a five-figure number decides against it before
              they reach a Book button that would have asked for a quarter of
              it — so the smaller number belongs beside the larger one, not a
              step further into the flow.

              Never restated arithmetic: the amount comes from the same engine
              that charges it, so the two cannot drift. When the whole trip is
              due — travel inside the balance window, or the minimum already
              covering the price — it says so instead, because offering a
              deposit that checkout will refuse is worse than offering none. */}
          {deposit && (
            <p className="mt-0.5 text-xs font-medium">
              {deposit.isFull ? (
                <span className="text-warning-700">Full payment due at booking</span>
              ) : (
                <>
                  <span className="font-semibold text-neutral-800">
                    Book with {form.currency} {deposit.amount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-neutral-500">
                    {" — balance "}
                    {form.currency} {deposit.balance.toLocaleString("en-IN")}
                    {deposit.balanceDueDate && ` by ${formatDueDate(deposit.balanceDueDate)}`}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {priceValue ? (
            <button
              type="button"
              onClick={handleBookNow}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-white bg-linear-to-r from-primary-500/85 to-primary-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:from-primary-400/85 hover:to-primary-500 disabled:opacity-60 disabled:cursor-not-allowed font-heading cursor-pointer"
            >
              {/* Names the option being bought, so what is about to be charged
                  is stated rather than inferred from a chip further up. */}
              Book {multi && chosen ? chosen.label : "Now"}
              {/* Only the icon changes while submitting. Swapping the whole
                  label for a spinner collapsed the button to the width of the
                  spinner — the one control on the page jumping and shrinking
                  at the exact moment a client has committed to paying. Both
                  glyphs are 14px, so the width does not move at all; the
                  disabled state and the dimming carry the rest. */}
              {submitting
                ? <Loader2 size={14} className="animate-spin" />
                : <ArrowRight size={14} />}
            </button>
          ) : null}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
