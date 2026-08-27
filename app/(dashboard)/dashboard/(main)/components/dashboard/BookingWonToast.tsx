"use client";

/**
 * BookingWonToast
 * ─────────────────────────────────────────────────────────────────────────────
 * The moment a trip this exec sold is actually paid for, said out loud on
 * whatever dashboard tab they happen to have open — no refresh, no polling.
 *
 * Renders nothing. It exists only to hold the subscription for the lifetime of
 * the page, the same way FunNotification holds its own timer, so any dashboard
 * that mounts it gets the toast without threading state through the tree.
 *
 * Deliberately not a durable notification: it fires from the payment
 * confirmation path, which already writes the booking, the timeline entry and
 * the ops handoff. This is recognition on top of a record that exists whether
 * or not anyone was watching — so missing one costs nothing.
 */

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBookingWon, type BookingWon } from "@/app/lib/ably-client";

function formatAmount(amountPaise: number, currency: string): string {
  const rupees = Math.round(amountPaise / 100);
  return `${currency} ${rupees.toLocaleString("en-IN")}`;
}

export function BookingWonToast({ memberId }: { memberId: string }) {
  const router = useRouter();

  useBookingWon(memberId, (won: BookingWon) => {
    toast.success(`🎉 ${won.packageTitle} is booked!`, {
      description:
        `${won.clientName ? `${won.clientName} just paid` : "Payment received"} `
        + `${formatAmount(won.amountPaise, won.currency)} · ${won.bookingNumber}`,
      duration: 15000,
      action: {
        label: "View booking",
        onClick: () => router.push(`/dashboard/package-bookings?booking=${won.bookingId}`),
      },
    });
    // The exec's own stat tiles (queries converted, bookings this month) are
    // server-rendered; refresh them so the number moves with the toast rather
    // than staying stale until they navigate.
    router.refresh();
  });

  return null;
}
