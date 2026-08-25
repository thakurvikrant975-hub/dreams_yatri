"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared "Book Now" flow for the custom-package page — same shape as the
 * catalog page's useBookQuote, minus the quote/date/pax selection (a custom
 * package's price, dates, and traveller counts are already fixed by the
 * sales exec). Used by both CustomPricingCard and CustomMobileFooterBar so
 * the logic lives once.
 */
export function useBookCustomPackage(packageId: string, stayOptionId?: string | null) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  /** Goes to the review step, not to payment.
   *
   * This used to create the booking on the spot and drop the client on a
   * payment screen — no confirmation of what was being bought, no policies
   * accepted, and no say in how much to pay, though the engine has always
   * allowed paying in full. The catalogue side has had that step since the
   * beginning; this is the same one.
   *
   * No login here either. Signing in belongs at the point of paying, which is
   * where the review step asks for it — a client should be able to read what
   * they are buying without an account. */
  function handleBookNow() {
    setSubmitting(true);
    const q = stayOptionId ? `?option=${encodeURIComponent(stayOptionId)}` : "";
    router.push(`/custom-package/${packageId}/book${q}`);
  }

  return { handleBookNow, submitting, error: null as string | null };
}
