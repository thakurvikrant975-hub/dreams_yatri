import { ArrowRight } from "lucide-react";

/** Always-reachable "Pay Now" bar for the client-facing custom-package page —
 * fixed to the bottom on mobile, sticky at the top on desktop, so the CTA
 * isn't buried at the end of a long itinerary document. Only rendered when
 * the exec has actually pasted a payment link for this package. */
export function PayNowBar({
  currency, totalPrice, paymentLink,
}: {
  currency: string;
  totalPrice: string;
  paymentLink: string;
}) {
  if (!paymentLink) return null;

  return (
    <div className="sticky top-0 lg:top-3 z-40 mb-4 lg:mb-6">
      <div className="mx-auto max-w-3xl rounded-none lg:rounded-2xl bg-neutral-900/95 backdrop-blur border-b lg:border border-white/10 shadow-lg px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">Total Package Price</p>
          <p className="text-base font-extrabold text-white leading-none mt-0.5">
            {currency} {totalPrice}
          </p>
        </div>
        <a
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-400 text-white font-bold text-sm px-4 py-2.5 rounded-full transition-colors shrink-0"
        >
          Pay Now <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
