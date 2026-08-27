import "server-only";
import type { GatewayId, PaymentProvider } from "./types";
import { razorpayProvider } from "./razorpay.provider";
import { payuProvider } from "./payu.provider";

/**
 * Provider registry. The active gateway is env-configured (`PAYMENT_PROVIDER`,
 * default RAZORPAY); `getProvider` resolves a gateway to its implementation.
 * Cases are wired as providers land: Razorpay (6.2), PayU (6.4).
 */

/**
 * PayU is switched off — Razorpay is the only gateway a customer can be sent
 * to.
 *
 * Turned off HERE, at the one chokepoint every caller already goes through,
 * rather than by pulling out the provider, the checkout form, the callback
 * route and the webhook handler. Those stay wired and tested, so turning PayU
 * back on is this constant and the env credentials, not a re-integration —
 * and the payment path, which took some work to get right, is not disturbed to
 * park a gateway nobody is using. There have never been any PayU payments, so
 * nothing historical is stranded by this.
 *
 * `getProvider("PAYU")` deliberately still resolves: reconciliation and refunds
 * address a payment by the gateway stored on its own row, and a switch here
 * must never be able to strand one.
 */
const PAYU_ENABLED = false;

export function activeGateway(): GatewayId {
    // PAYMENT_PROVIDER=PAYU is ignored while the flag above is off, rather than
    // quietly producing a default nobody asked for — the flag is the decision.
    if (!PAYU_ENABLED) return "RAZORPAY";
    return process.env.PAYMENT_PROVIDER?.toUpperCase() === "PAYU" ? "PAYU" : "RAZORPAY";
}

/** Gateways that have credentials configured — what the customer may choose from (default first). */
export function enabledGateways(): GatewayId[] {
    const list: GatewayId[] = [];
    if (process.env.RAZORPAY_KEY_ID && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) list.push("RAZORPAY");
    if (PAYU_ENABLED && process.env.PAYU_KEY && process.env.PAYU_SALT) list.push("PAYU");
    if (list.length === 0) list.push(activeGateway());
    const def = activeGateway();
    return [...list].sort((a, b) => (a === def ? -1 : b === def ? 1 : 0));
}

export function getProvider(gateway: string): PaymentProvider {
    switch (gateway) {
        case "RAZORPAY":
            return razorpayProvider;
        case "PAYU":
            return payuProvider;
        default:
            throw new Error(`PaymentProvider not implemented for gateway: ${gateway}`);
    }
}
