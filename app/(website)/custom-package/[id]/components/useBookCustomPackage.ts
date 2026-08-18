"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useModal } from "@/app/hooks/useModals";
import { createCustomPackageBookingDraft } from "@/app/actions/payment/booking.actions";

/**
 * Shared "Book Now" flow for the custom-package page — same shape as the
 * catalog page's useBookQuote, minus the quote/date/pax selection (a custom
 * package's price, dates, and traveller counts are already fixed by the
 * sales exec). Used by both CustomPricingCard and CustomMobileFooterBar so
 * the logic lives once.
 */
export function useBookCustomPackage(packageId: string, stayOptionId?: string | null) {
  const router = useRouter();
  const { openModal } = useModal();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBookNow() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await createCustomPackageBookingDraft(packageId, stayOptionId);
      if (!res.success) {
        setSubmitting(false);
        if (res.reason === "unauthenticated") {
          openModal("login-modal", {
            redirectTo: window.location.pathname,
            // Re-attempt the booking once logged in, rather than leaving the
            // guest to wonder why verifying the OTP didn't do anything.
            onSuccess: () => { handleBookNow(); },
          });
          return;
        }
        setError(res.message ?? "Could not start your booking. Please try again.");
        return;
      }
      router.push(`/bookings/${res.bookingId}/pay`);
    } catch (err) {
      console.error("[useBookCustomPackage] failed", err);
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return { handleBookNow, submitting, error };
}
