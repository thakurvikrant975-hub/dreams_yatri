/**
 * Shared types for the payment-schedule action layer.
 * Plain module (NOT 'use server') — safe to `import type` from client components.
 */
import type { CheckoutInit } from "@/app/lib/payments/types";

export interface PaymentScheduleDTO {
    plan: "FULL" | "DEPOSIT";
    totalPaise: number;
    depositPaise: number;
    balancePaise: number;
    balanceDueDate: string | null; // YYYY-MM-DD, null for FULL
    currency: string;
    reason: string;
}

export type PaymentScheduleResult =
    | { success: true; schedule: PaymentScheduleDTO }
    | { success: false; reason: "not_found" | "invalid" };

/** What the client needs to launch checkout (gateway-agnostic). No secrets. */
export interface BookingOrderDTO {
    bookingId: string;
    bookingNumber: string;
    plan: "FULL" | "DEPOSIT";
    amountPaise: number;
    checkout: CheckoutInit;
}

export type CreateBookingOrderReason =
    | "unauthenticated"
    | "not_found"
    | "invalid"
    | "not_active"
    | "stale"
    | "error";

export type CreateBookingOrderResult =
    | { success: true; order: BookingOrderDTO }
    | { success: false; reason: CreateBookingOrderReason; message?: string };

/** Step 1 of MMT-style checkout: the Booking is created (no gateway charge yet). */
export type CreateBookingResult =
    | { success: true; bookingId: string; bookingNumber: string }
    | { success: false; reason: CreateBookingOrderReason; message?: string };

/**
 * The custom-package path's own result: everything above, plus one refusal the
 * client resolves on the spot rather than an error.
 *
 * `contact_required` means we do not hold a name, an email AND a phone for
 * whoever is paying, and an invoice cannot be addressed without all three. It
 * carries what we already know so the form opens filled in, and which channel
 * the session already proved.
 *
 * Its own type rather than a wider CreateBookingResult: only this path can
 * return it, and widening the shared one made every existing consumer of
 * `.message` — the catalogue review, the hotel checkout — stop type-checking
 * for a case none of them can ever receive.
 */
export type CreateCustomBookingResult =
    | CreateBookingResult
    | {
        success: false; reason: "contact_required";
        prefill: { name: string; email: string; phone: string; verified: "email" | "phone" | null };
    };

/** Browser-callback verify — confirms the checkout signature (UX only; truth = webhook). */
export type VerifyCheckoutResult =
    | { success: true; bookingId: string }
    | { success: false; reason: "invalid_signature" | "not_found" | "unauthenticated" };

export interface CancelRefundLine {
    paymentId: string;
    refundId: string;
    state: "processed" | "pending" | "failed";
    amountPaise: number;
}

export type CancelBookingResult =
    | {
          success: true;
          alreadyCancelled: boolean;
          paidPaise: number;
          refundablePaise: number;
          feePaise: number;
          refundPct: number;
          refunds: CancelRefundLine[];
      }
    | { success: false; reason: "unauthenticated" | "not_found" | "forbidden" | "not_cancellable" | "error"; message?: string };

/** Read-only preview of what a cancellation would refund (for the confirm dialog). */
export interface CancellationPreview {
    paidPaise: number;
    refundablePaise: number;
    feePaise: number;
    refundPct: number;
    daysToTravel: number;
}

export type DateChangeDirection = "topup" | "refund" | "balance" | "none";

/** Read-only preview of a date change (for the confirm dialog). */
export interface DateChangePreview {
    newDate: string;
    oldTotalPaise: number;
    newTotalPaise: number;
    feePaise: number;
    paidPaise: number;
    newOutstandingPaise: number; // (newTotal + fee) − paid
    direction: DateChangeDirection;
    settleAmountPaise: number; // amount charged (topup) or refunded (refund)
}

export type DateChangeResult =
    | { success: true; direction: "topup"; bookingId: string; amountPaise: number; checkout: CheckoutInit }
    | { success: true; direction: "refund" | "balance" | "none"; bookingId: string; amountPaise: number }
    | { success: false; reason: "unauthenticated" | "not_found" | "forbidden" | "not_changeable" | "unpriceable" | "invalid_date" | "error"; message?: string };
