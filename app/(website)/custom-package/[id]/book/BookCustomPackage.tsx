"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The step between reading a quote and paying for it.
//
// The catalogue side has always had this: /book/[quoteId] shows what is about
// to be bought, asks the client to accept the policies, and lets them choose
// between the deposit and the whole amount. A custom package went from a Book
// button straight to a payment screen — no confirmation of what was being
// bought, no policies accepted, and no choice about how much to pay, even
// though the payment engine has supported paying in full all along.
//
// Deliberately a mirror of BookReview rather than a shared component: that one
// is built around a quote, its freshness countdown and a traveller form, none
// of which exist here — a custom package's travellers, dates and price were
// settled by the exec before the client ever saw it. What is shared is the
// shape of the decision, so the two read as one product.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useModal } from "@/app/hooks/useModals";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { Calendar, ChevronRight, Moon, Users, Wallet } from "lucide-react";
import { possessive } from "@/app/lib/possessive";
import { Heading, Text } from "@/app/components/ui/Typography";
import SavingsBadge from "@/app/components/packages/SavingBadge";
import { createCustomPackageBookingDraft } from "@/app/actions/payment/booking.actions";

export type BookSummary = {
  packageId: string;
  title: string;
  destination: string | null;
  /** The itinerary's own cover, so the review looks like the quote it came
   *  from rather than a bare form. */
  coverImage: string | null;
  travelDate: string | null;
  nights: number;
  days: number;
  travellers: number;
  /** Who the trip is for, for the cover's handwritten line. */
  clientName: string | null;
  /** "1 Adult, 1 Child, 1 Infant" — the party as the itinerary's own stats
   *  card states it, infants included. `travellers` is the paying count and
   *  is not the same number. */
  paxLine: string;
  currency: string;
  /** What is being bought — the chosen option's price, or the package's own. */
  total: number;
  optionId: string | null;
  optionLabel: string | null;
  discount: { originalPrice: number; amount: number; label: string } | null;
  /** From computePaymentSchedule, against the price above. */
  depositAmount: number;
  balanceAmount: number;
  balanceDueDate: string | null;
  /** True when policy leaves no choice: inside the balance window, or the
   *  minimum deposit already covers the trip. */
  mustPayFull: boolean;
};

const money = (currency: string, n: number) => `${currency} ${Math.round(n).toLocaleString("en-IN")}`;

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BookCustomPackage({ summary }: { summary: BookSummary }) {
  const router = useRouter();
  const { openModal } = useModal();
  const [payChoice, setPayChoice] = useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [policy, setPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The engine decides whether a deposit is allowed at all; the client only
  // chooses when it is. Showing a choice that checkout would override is how
  // a client ends up believing they paid a deposit on a trip that required
  // the lot.
  const choice: "DEPOSIT" | "FULL" = summary.mustPayFull ? "FULL" : payChoice;
  const payNow = choice === "FULL" ? summary.total : summary.depositAmount;

  async function proceed() {
    setSubmitting(true);
    setError(null);
    try {
      // The total this page put in front of the client, sent so the service
      // can refuse to charge a different one. Not a price — a claim about
      // what was seen.
      const res = await createCustomPackageBookingDraft(
        summary.packageId, summary.optionId, choice, summary.total,
      );
      if (!res.success) {
        setSubmitting(false);
        if (res.reason === "unauthenticated") {
          // Signing in returns here, not to the itinerary — the client has
          // already made every decision this page asks for.
          openModal("login-modal", {
            redirectTo: window.location.pathname + window.location.search,
            onSuccess: () => { proceed(); },
          });
          return;
        }
        setError(res.message ?? "Could not start your booking. Please try again.");
        // A price that moved is the one failure the client can clear
        // themselves, and only by re-reading the page. Refreshed for them, so
        // the figures on screen are the ones the next attempt will use.
        if (res.message?.includes("price changed")) router.refresh();
        return;
      }
      router.push(`/bookings/${res.bookingId}/pay`);
    } catch (err) {
      console.error("[BookCustomPackage] failed", err);
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    // Grey ground, a dark bar naming the step, then one 500px column: what
    // is being bought, the itinerary it came from, and the decision — in the
    // order they are read, at a width that is the same on a phone and on a
    // desktop.
    //
    // This used to be a two-column grid with the decision pinned in a 360px
    // rail. The rail earns its keep on a page you scroll — it keeps the
    // amount and the button in view while you read — but there are three
    // short cards here and nothing to scroll past, so on a wide screen it
    // bought nothing and left most of the page empty.
    <div className="bg-neutral-100 min-h-screen pb-16">
      <div className="bg-surface-inverse text-white">
        <div className="screen-space flex flex-wrap items-center justify-between gap-3 py-3.5">
          <span className="text-base font-medium">Review Booking</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
            Prepared by your travel manager
          </span>
        </div>
      </div>

      {/* The way back to the thing being bought. This was a card of its own —
          a heading, a sentence and a link, for one destination — which is more
          furniture than a back-link deserves. A breadcrumb says the same thing
          in one line and says it where people look for it. */}
      <nav aria-label="Breadcrumb" className="screen-space pt-4">
        <ol className="mx-auto flex w-full max-w-[500px] items-center gap-1.5 text-xs">
          <li>
            <Link href={`/custom-package/${summary.packageId}`} className="font-medium text-neutral-500 transition-colors hover:text-primary-600">
              Your itinerary
            </Link>
          </li>
          <li aria-hidden="true" className="text-neutral-300"><ChevronRight size={13} /></li>
          <li aria-current="page" className="font-semibold text-neutral-800">Review booking</li>
        </ol>
      </nav>

      {/* ── The cover, as the itinerary itself opens ──────────────────────────
          The same lockup the client just came from: their name in script over
          the title, the duration beside it, and the trip's three facts on a
          card that overlaps the photo's bottom edge. It was a 500px card with
          a thumbnail in it, which made the page they were leaving and the page
          they were paying on look like two different products.

          Full-bleed photo, but the words on it keep the column's measure, so
          the lockup's left edge and the payment card's line up. */}
      <div className="relative mt-4 h-56 w-full overflow-hidden bg-neutral-800 sm:h-72">
        {summary.coverImage && (
          /* eslint-disable-next-line @next/next/no-img-element -- stored URL, not a known host */
          <img src={summary.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {/* A scrim, not a flat tint: the words sit at the bottom and a photo
            that is bright exactly there is the one that eats them. */}
        <div className="absolute inset-0 bg-linear-to-t from-neutral-950/85 via-neutral-950/45 to-neutral-950/10" />
        <div className="screen-space absolute inset-x-0 bottom-0 pb-8 sm:pb-10">
          <div className="mx-auto w-full max-w-[500px]">
            {summary.clientName && (
              // Overlapping the title's cap height by a few px is what makes
              // the two a lockup rather than two stacked lines; leading-[1.3]
              // is what keeps that overlap from becoming a collision, since
              // the script's descenders run well past its em box.
              <span
                aria-hidden="true"
                className="-mb-1 ml-0.5 block w-max -rotate-2 origin-bottom-left text-[26px] font-bold leading-[1.3] text-primary-400 sm:text-[30px]"
                style={{ fontFamily: "var(--font-script)", textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}
              >
                {possessive(summary.clientName)}
              </span>
            )}
            <h1
              className="font-heading text-[26px] font-bold leading-[1.08] text-white sm:text-[32px]"
              style={{ letterSpacing: "-0.02em", textWrap: "balance", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
            >
              {summary.title}
            </h1>
            {summary.days > 0 && (
              <div className="mt-2.5 flex items-center gap-3">
                <span className="inline-flex items-center gap-2.5 rounded-pill border border-primary-100 bg-primary-400/5 px-3 py-1 font-heading text-[13px] font-bold text-white ring-[0.12em] ring-inset ring-primary-400">
                  {summary.days} Day{summary.days !== 1 ? "s" : ""}
                  <span className="h-3.5 w-px bg-primary-300" />
                  {summary.nights} Night{summary.nights !== 1 ? "s" : ""}
                </span>
                <span className="font-heading text-[17px] font-bold leading-none text-white">TRIP</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="screen-space">
        {/* Overlapping the cover, exactly as it does on the itinerary — it is
            what stops the photo from ending in a hard line across the page. */}
        {/* relative z-10, as the itinerary's own stats card carries: the hero
            above is a positioned element, so without it the overlapping third
            of this card paints underneath the photo and the three labels
            simply vanish. */}
        <div className="relative z-10 mx-auto -mt-7 w-full max-w-[500px]">
          <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-white shadow-lg shadow-neutral-300/60 ring-1 ring-inset ring-(--border-default)">
            <Stat icon={Calendar} label="Travel date" value={summary.travelDate ? formatDate(summary.travelDate) : "—"} />
            <Stat icon={Moon} label="Duration" value={`${summary.days}D / ${summary.nights}N`} />
            <Stat icon={Users} label="Travellers" value={summary.paxLine} />
          </div>
          {/* Named only when the package quoted more than one, so a client who
              never had a choice is not shown one they did not make. */}
          {summary.optionLabel && (
            <Text size="xs" intent="secondary" className="mt-2.5 block text-center">
              Stay standard: <span className="font-medium text-neutral-700">{summary.optionLabel}</span>
            </Text>
          )}
        </div>
      </div>

      <div className="screen-space pt-5">
        {/* min-w-0 so the column can be narrower than its contents want to
            be. Without it a flex column sizes to its items' max-content and
            body's `overflow-x: clip` cuts the excess instead of scrolling it
            — which is how the amount and the confirm button ended up off the
            right edge of a 390px screen with no way to reach them. */}
        <div className="mx-auto flex w-full min-w-0 max-w-[500px] flex-col gap-4">

          {/* ── The decision ─────────────────────────────────────────── */}
          <SectionCard icon={Wallet} title="Payment">
              {/* The label on its own line, then every figure on the next.
                  Side by side, the was-price, the payable one and the badge
                  had to share a rail with the words "Package total", which is
                  why the badge had been pushed out into a bordered strip of
                  its own with nothing else in it. Together they read as one
                  statement: this is the price, this is what came off it. */}
              <div className="px-5 py-4 border-b border-(--border-muted)">
                <Text size="sm" intent="secondary" className="block">Package total</Text>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
                  {summary.discount && (
                    <span className="text-sm text-neutral-400 line-through tabular-nums">
                      {money(summary.currency, summary.discount.originalPrice)}
                    </span>
                  )}
                  <Text size="xl" weight="bold" intent="primary" className="font-heading tracking-tight">
                    {money(summary.currency, summary.total)}
                  </Text>
                  {summary.discount && (
                    <SavingsBadge amount={summary.discount.label} prefix="" className="shrink-0 mx-1.5" />
                  )}
                </div>
              </div>

              {summary.mustPayFull ? (
                <div className="px-5 py-4 border-b border-(--border-muted)">
                  <Text size="sm" weight="semibold" intent="primary" className="block">Full payment due</Text>
                  <Text size="xs" intent="muted" className="block mt-0.5">
                    {summary.depositAmount >= summary.total
                      ? "This trip is paid in one instalment."
                      : "Travel is close enough that the balance is already due, so the whole amount is payable now."}
                  </Text>
                </div>
              ) : (
                <div className="px-5 py-4 border-b border-(--border-muted) flex flex-col gap-2.5">
                  <PayOption
                    selected={choice === "DEPOSIT"} onSelect={() => setPayChoice("DEPOSIT")}
                    title="Pay advance to book" amount={money(summary.currency, summary.depositAmount)}
                    sub={`Balance ${money(summary.currency, summary.balanceAmount)}${summary.balanceDueDate ? ` by ${formatDate(summary.balanceDueDate)}` : ""}`}
                  />
                  <PayOption
                    selected={choice === "FULL"} onSelect={() => setPayChoice("FULL")}
                    title="Pay full amount now" amount={money(summary.currency, summary.total)}
                    sub="Nothing left to pay later."
                  />
                </div>
              )}

              <div className="px-5 py-4">
                {/* An eyebrow, not a second heading: the card is already
                    titled "Payment", and two same-weight headings inside one
                    card read as two cards that failed to separate. */}
                <Text size="xs" weight="semibold" intent="muted" className="mb-2 block uppercase tracking-wide">Confirm &amp; book</Text>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)}
                    className="mt-0.5 size-4 cursor-pointer shrink-0 accent-primary-500"
                  />
                  <Text size="xs" intent="secondary">
                    I confirm I have read and accept the{" "}
                    <Link href="/cancellation-policy" target="_blank" className="text-primary-500 underline">Cancellation Policy</Link>,{" "}
                    <Link href="/terms" target="_blank" className="text-primary-500 underline">Terms of Service</Link>{" and "}
                    <Link href="/privacy-policy" target="_blank" className="text-primary-500 underline">Privacy Policy</Link>.
                  </Text>
                </label>

                <Button
                  variant="premium" size="lg" className="w-full mt-4"
                  onClick={proceed} loading={submitting} disabled={!policy || submitting}
                >
                  {policy ? `Pay ${money(summary.currency, payNow)} now` : "Accept policies to continue"}
                </Button>

                {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/** One cell of the trip-stats card — the same three facts, drawn the same
 *  way, as the StatCell on the itinerary this page came from. */
function Stat({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="mb-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-neutral-500/90 sm:text-[13px]">
        <Icon size={14} className="shrink-0 text-neutral-400/90" /> {label}
      </p>
      {/* truncate, not wrap: three cells share 500px and "1 Adult, 1 Child,
          1 Infant" is the one that overruns. The full party is restated in
          the payment card's own copy. */}
      <p className="truncate font-heading text-[13px] font-bold leading-tight text-neutral-900 sm:text-[15px]">
        {value}
      </p>
    </div>
  );
}

/** The page's one card.
 *
 * Three cards were being drawn three ways — two hand-rolled
 * `rounded-xl bg-white shadow-sm` divs and one <Card>, whose elevated
 * variant carries a heavier shadow and an inset ring. Side by side in a
 * single column that reads as a mistake rather than a hierarchy.
 *
 * The header is the catalogue review's own Section idiom (an icon tile and a
 * title over a hairline, then a padded body), because this page is
 * deliberately a mirror of that one — see the note at the top of this file.
 * An icon rather than that page's step number: these are three things to
 * read, not three steps to complete, and only the last one asks for
 * anything. */
function SectionCard({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-(--border-muted) px-5 py-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">
          <Icon size={15} />
        </span>
        <Heading level={4} weight="semibold">{title}</Heading>
      </div>
      {children}
    </Card>
  );
}


/** Same control the catalogue's review uses, so the choice looks identical
 *  whichever way a client arrived at it. */
function PayOption({ selected, onSelect, title, amount, sub }: {
  selected: boolean; onSelect: () => void; title: string; amount: string; sub: string;
}) {
  return (
    <button
      type="button" onClick={onSelect}
      className={`w-full text-left cursor-pointer rounded-lg border px-3 py-2.5 transition ${
        selected ? "border-primary-500 ring-2 ring-primary-200 bg-primary-50/60" : "border-(--border-muted) hover:border-primary-300"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary-500" : "border-neutral-300"}`}>
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Text size="sm" weight="semibold" intent="primary">{title}</Text>
            <Text size="sm" weight="bold" intent="primary">{amount}</Text>
          </div>
          <Text size="xs" intent="muted" className="block mt-0.5">{sub}</Text>
        </div>
      </div>
    </button>
  );
}
