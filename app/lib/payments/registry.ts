import "server-only";
import type { GatewayId, PaymentProvider } from "./types";
import { razorpayProvider } from "./razorpay.provider";

/**
 * Provider registry. The active gateway is env-configured (`PAYMENT_PROVIDER`,
 * default RAZORPAY); `getProvider` resolves a gateway to its implementation.
 * Cases are wired as providers land: Razorpay (6.2), PayU (6.4).
 */

export function activeGateway(): GatewayId {
    return process.env.PAYMENT_PROVIDER?.toUpperCase() === "PAYU" ? "PAYU" : "RAZORPAY";
}

export function getProvider(gateway: string): PaymentProvider {
    switch (gateway) {
        case "RAZORPAY":
            return razorpayProvider;
        // PAYU → 6.4
        default:
            throw new Error(`PaymentProvider not implemented for gateway: ${gateway}`);
    }
}
