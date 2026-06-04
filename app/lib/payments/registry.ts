import "server-only";
import type { GatewayId, PaymentProvider } from "./types";
import { razorpayProvider } from "./razorpay.provider";
import { payuProvider } from "./payu.provider";

/**
 * Provider registry. The active gateway is env-configured (`PAYMENT_PROVIDER`,
 * default RAZORPAY); `getProvider` resolves a gateway to its implementation.
 * Cases are wired as providers land: Razorpay (6.2), PayU (6.4).
 */

export function activeGateway(): GatewayId {
    return process.env.PAYMENT_PROVIDER?.toUpperCase() === "PAYU" ? "PAYU" : "RAZORPAY";
}

/** Gateways that have credentials configured — what the customer may choose from (default first). */
export function enabledGateways(): GatewayId[] {
    const list: GatewayId[] = [];
    if (process.env.RAZORPAY_KEY_ID && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) list.push("RAZORPAY");
    if (process.env.PAYU_KEY && process.env.PAYU_SALT) list.push("PAYU");
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
