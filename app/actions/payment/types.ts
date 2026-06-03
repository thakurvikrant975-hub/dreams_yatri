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

/** Browser-callback verify — confirms the checkout signature (UX only; truth = webhook). */
export type VerifyCheckoutResult =
    | { success: true; bookingId: string }
    | { success: false; reason: "invalid_signature" | "not_found" | "unauthenticated" };
