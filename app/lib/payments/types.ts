/**
 * Gateway-agnostic payment abstraction.
 *
 * Plain module (NOT server-only) so the client can import `CheckoutInit`. The
 * concrete providers (Razorpay, PayU) live in server-only modules and implement
 * `PaymentProvider`; the shared booking/webhook/recon flow only ever speaks
 * these normalized shapes.
 */

export type GatewayId = "RAZORPAY" | "PAYU";

// ── What the client launches ─────────────────────────────────────────────────
// Discriminated union: Razorpay = JS modal with an order id; PayU = auto-submit
// a form to a hosted page.
export type CheckoutInit =
    | { provider: "RAZORPAY"; orderId: string; keyId: string; amountPaise: number; currency: string }
    | { provider: "PAYU"; actionUrl: string; fields: Record<string, string> };

// ── createCharge ─────────────────────────────────────────────────────────────
export interface CreateChargeInput {
    amountPaise: number;
    receipt: string; // our booking number / short ref
    bookingId: string;
    customer: { name?: string; email?: string; phone?: string };
    notes?: Record<string, string>;
    // Redirect-based providers (PayU) need return URLs.
    successUrl?: string;
    failureUrl?: string;
}

export interface CreateChargeResult {
    /** Stored on Payment.gatewayOrderId — Razorpay order id, or PayU txnid. */
    gatewayOrderRef: string;
    /** What the browser launches. */
    checkout: CheckoutInit;
}

// ── Browser callback verification ────────────────────────────────────────────
export interface CallbackResult {
    valid: boolean;
    gatewayOrderRef?: string;
    gatewayPaymentId?: string;
}

// ── Normalized webhook event (what the shared processor acts on) ──────────────
export interface NormalizedWebhookEvent {
    eventId: string; // dedupe key (provider event id / mihpayid / txnid)
    type: "captured" | "failed" | "refunded" | "other";
    gatewayOrderRef?: string; // to locate our Payment (Razorpay order_id / PayU txnid)
    gatewayPaymentId?: string;
    amountPaise?: number;
    method?: string;
    refundId?: string;
    refundAmountPaise?: number;
    failureReason?: string;
}

// ── Reconciliation status ────────────────────────────────────────────────────
export interface ChargeStatus {
    state: "captured" | "failed" | "pending";
    gatewayPaymentId?: string;
    method?: string;
}

// ── The provider contract (implemented by server-only adapters) ───────────────
export interface PaymentProvider {
    gateway: GatewayId;
    createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
    verifyCallback(payload: Record<string, string>): CallbackResult;
    verifyWebhook(rawBody: string, headers: Headers): boolean;
    parseWebhookEvent(rawBody: string, headers: Headers): NormalizedWebhookEvent | null;
    fetchChargeStatus(gatewayOrderRef: string): Promise<ChargeStatus>;
}
