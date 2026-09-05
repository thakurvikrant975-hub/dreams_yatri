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
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { ItineraryDocument, type PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import SavingsBadge from "@/app/components/packages/SavingBadge";
import { useBookCustomPackage } from "./useBookCustomPackage";
import type { SharedPackageBooking } from "@/app/actions/packages/fetch-shared-package";
import { PUBLISHED_THEME } from "./published-theme";

/** "12 Sep 2026" — the balance date, in the form a client reads rather than
 *  the ISO the engine returns. */
function formatDueDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PublishedItinerary({ form, packageId, booking }: {
  form: PreviewData;
  packageId: string;
  /** The confirmed booking made from this link, when there is one — turns the
   * sticky Book bar into a receipt. Null until the client actually pays. */
  booking: SharedPackageBooking | null;
}) {
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

      {/* Once it is paid for, the bar stops asking for money and becomes the
          receipt. Two components rather than a branch inside one: BookingBar
          holds the stay-option and deposit state, and an early return above
          those hooks would skip them. */}
      {booking
        ? <PaidBar booking={booking} />
        : <BookingBar form={form} packageId={packageId} />}
    </>
  );
}

/** The client keeps this link and reopens it after paying, so the bar has to
 * answer "did that go through?" and give them somewhere to go. Leaving a live
 * "Book Now" here is also how one trip gets paid for twice. */
function PaidBar({ booking }: { booking: SharedPackageBooking }) {
  return (
    <div className="no-print sticky bottom-0 z-50 mt-6 border-t border-success-200 bg-success-50/95 backdrop-blur px-4 py-3">
      <div className="mx-auto w-full max-w-4xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700">
            <Check size={17} strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-success-900">
              Payment received — you&apos;re booked!
            </span>
            <span className="block text-xs text-success-800/80">
              {booking.paidLabel} · Booking {booking.bookingNumber}
            </span>
          </span>
        </div>
        <Link
          href={`/bookings/${booking.id}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-success-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-success-800"
        >
          View booking &amp; invoice <ArrowRight size={15} />
        </Link>
      </div>
    </div>
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
  const recommendedId = options.find((o) => o.isRecommended)?.id ?? null;

  const { handleBookNow, submitting, error } = useBookCustomPackage(packageId, chosenId);
  // Only meaningful against the package's own total. A client who has picked a
  // different standard is being quoted that column's price, and the deposit
  // for it is not this one — so it is withheld rather than shown wrong.
  // Both the deposit and the discount describe the PACKAGE's own total. A
  // client who has switched to another standard is being quoted that column's
  // price, and neither figure was computed against it — so both are withheld
  // rather than shown against a number they do not belong to.
  const onPackagePrice = !(multi && chosen && chosen.id !== recommendedId);
  const deposit = onPackagePrice ? form.bookingDeposit ?? null : null;
  const discount = onPackagePrice ? form.discount ?? null : null;
  const totalPax = form.adults + form.children;

  // The chosen option's price leads once there is a choice, because that is the
  // number this button is about to charge — and it has to be the same number
  // createBookingFromCustomPackage will arrive at, or the bar quotes a figure
  // the next click rejects.
  //
  // Two rules, both taken from that service:
  //   · an option with no STORED price is refused outright, recommended or
  //     not, so it is not bookable here either. It used to fall through to the
  //     package's own total, which put a price and a live Book button on an
  //     option checkout would then turn away.
  //   · the recommended option is charged at the package's total; every other
  //     one at its own.
  const packageTotal = form.totalPrice ? Number(form.totalPrice) : null;
  const priceValue = multi
    ? ((chosen?.totalPrice ?? 0) > 0
        ? (chosen!.id === recommendedId ? packageTotal : chosen!.totalPrice!)
        : null)
    : packageTotal;
  const priceStr = priceValue
    ? `${form.currency} ${priceValue.toLocaleString("en-IN")}`
    : "To be confirmed";

  return (
    // py-2 on a phone. This bar is stuck over the document, so every pixel of
    // it is a pixel of the itinerary the client cannot see; at three standards
    // it was taking a sixth of a 390px screen (a fifth at 320px).
    <div className="no-print sticky bottom-0 z-50 mt-6 border-t border-neutral-200 bg-white/95 backdrop-blur px-4 py-2 sm:py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      {multi && (
        // One line that scrolls, rather than two that wrap. Three standards
        // wrapped onto a second row on every phone, and a second row here
        // costs the same 30px whether or not the client ever reads it.
        // Bleeds to the screen edges so a half-visible chip reads as "there is
        // more", which is what tells anyone to swipe at all.
        <div className="-mx-4 px-4 sm:mx-auto sm:px-0 mb-1.5 sm:mb-2 flex w-auto sm:w-full max-w-4xl flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto sm:overflow-visible scrollbar-none">
          {options.map((o) => {
            const on = o.id === chosenId;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setChosenId(o.id)}
                aria-pressed={on}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${on
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
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 sm:gap-4">
        {/* min-w-0 all the way down. flex-1 alone does not let a flex item
            shrink below its content, so the price row simply ran under the
            Book button — 29px of overlap at 390px, 99px at 320px, and only
            once a discount existed to widen it with a struck figure and a
            badge. */}
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4">
          <div className="min-w-0">
            {/* What it was, then what it is. The struck figure alone reads as a
              correction — the green saving beside it is what says a concession
              was made, which is the part a client repeats to whoever else is
              deciding with them. */}
          {/* A div, not a p: SavingsBadge renders a div for its serrated
              edges, and a div inside a p is invalid HTML — the browser closes
              the paragraph early and React's hydration then disagrees with
              the DOM it finds. Nothing here is a paragraph anyway; it is a
              row of figures. */}
          {/* flex-wrap rather than a hand-picked narrow breakpoint: at 320px
              the price, the badge and a "Book Standard" button do not fit on
              one line whatever we do, so the badge drops below the price — and
              only there. Nothing moves at 360 and up. */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            {discount && (
              // Desktop only. On a phone there is not room for was-price,
              // is-price, badge and button on one line at any size worth
              // supporting, and of the four the struck figure is the one that
              // reads fine a line down — the badge still says a concession was
              // made, which is the part that has to be seen first.
              <span className="hidden sm:inline text-sm text-neutral-400 line-through tabular-nums shrink-0">
                {form.currency} {Math.round(discount.originalPrice).toLocaleString("en-IN")}
              </span>
            )}
            {/* shrink-0: a truncated price is worse than a wrapped bar. */}
            <span className="shrink-0 font-heading text-lg font-bold tracking-tight text-primary-500">{priceStr}</span>
            {discount && (
              // The same badge the document's price panel uses, so the saving
              // looks like one thing in both places. Its serrated edges are
              // absolutely positioned outside the box, hence the margin — the
              // flex gap alone would clip them against the price.
              <SavingsBadge amount={discount.label} prefix="" className="shrink-0 mx-1.5" />
            )}
          </div>
            <p className="truncate text-xs text-neutral-500">
              {/* Where the struck figure goes on a phone — see the note on the
                  desktop one above. Its separator lives inside the same span
                  so the two disappear together at sm. */}
              {discount && (
                <span className="sm:hidden">
                  <span className="line-through tabular-nums">
                    {form.currency} {Math.round(discount.originalPrice).toLocaleString("en-IN")}
                  </span>
                  {" · "}
                </span>
              )}
              {/* Trimmed to what the line still has room for once the struck
                  figure joins it. "Total for" is scaffolding, and the chosen
                  standard is already the Book button's own label — without
                  this the line truncated mid-word at "2 traveller…" and cut
                  the standard off anyway. */}
              <span className="hidden sm:inline">Total for </span>
              {totalPax} traveller{totalPax !== 1 ? "s" : ""}
              {chosen && multi && (
                <span className="hidden sm:inline">
                  {" · "}<span className="font-medium text-neutral-700">{chosen.label}</span>
                </span>
              )}
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
            <p className="min-w-0 truncate text-xs font-medium sm:mt-0.5">
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
