/**
 * Shared types for the payment-schedule action layer.
 * Plain module (NOT 'use server') — safe to `import type` from client components.
 */

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
