import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/app/lib/db";
import { getProvider, enabledGateways } from "@/app/lib/payments/registry";
import { payuReturnUrl } from "./create-booking.service";
import type { CheckoutInit, GatewayId } from "@/app/lib/payments/types";
import type { CreateBookingOrderResult } from "./types";

/**
 * Pay an outstanding balance on an already-active booking — e.g. the extra
 * amount added when ops swap a hotel/room for a costlier one (confirmHotelStay
 * folds the delta into Booking.balanceAmount_paise). Charges the gateway for
 * the current balance with `purpose: "BALANCE"`; the webhook's generic
 * finalizeCapturedPayment TOPUP/BALANCE branch settles it.
 */
export async function createBalanceOrderForBooking(params: {
    bookingId: string;
    userId: string;
    gateway?: GatewayId;
}): Promise<CreateBookingOrderResult> {
    const booking = await db.booking.findUnique({
        where: { id: params.bookingId },
        select: { id: true, userId: true, bookingNumber: true, currency: true, status: true, paymentStatus: true, balanceAmount_paise: true },
    });
    if (!booking) return { success: false, reason: "not_found" };
    if (booking.userId !== params.userId) {
        return { success: false, reason: "invalid", message: "Booking belongs to another user." };
    }
    if (booking.status === "CANCELLED") {
        return { success: false, reason: "not_active", message: "This booking is cancelled." };
    }
    if (booking.paymentStatus === "PENDING") {
        return { success: false, reason: "invalid", message: "Please complete your initial payment first." };
    }
    if (booking.balanceAmount_paise <= 0) {
        return { success: false, reason: "invalid", message: "There is no outstanding balance to pay." };
    }

    const enabled = enabledGateways();
    const defaultGateway: GatewayId = enabled[0];

    // Reuse an open PENDING balance leg for the same amount; otherwise start a fresh one
    // (the balance may have changed since an earlier attempt).
    const pendings = await db.payment.findMany({
        where: { bookingId: booking.id, purpose: "BALANCE", status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, gateway: true, amount_paise: true, gatewayOrderId: true },
    });
    let payment = pendings.find((p) => p.amount_paise === booking.balanceAmount_paise) ?? null;
    if (!payment) {
        payment = await db.payment.create({
            data: {
                bookingId: booking.id,
                userId: booking.userId,
                amount: (booking.balanceAmount_paise / 100).toFixed(2),
                amount_paise: booking.balanceAmount_paise,
                gateway: params.gateway && enabled.includes(params.gateway) ? params.gateway : defaultGateway,
                status: "PENDING",
                purpose: "BALANCE",
                idempotencyKey: `booking:${booking.id}:balance:${randomBytes(4).toString("hex")}`,
            },
            select: { id: true, gateway: true, amount_paise: true, gatewayOrderId: true },
        });
    }

    const wantGateway: GatewayId =
        params.gateway && enabled.includes(params.gateway) ? params.gateway : (payment.gateway as GatewayId);
    const reuse = Boolean(payment.gatewayOrderId) && payment.gateway === wantGateway;
    const provider = getProvider(wantGateway);

    let checkout: CheckoutInit;
    if (reuse && payment.gatewayOrderId) {
        checkout = provider.checkoutForExistingOrder({
            gatewayOrderRef: payment.gatewayOrderId,
            amountPaise: payment.amount_paise,
            currency: booking.currency,
            successUrl: payuReturnUrl(booking.id, "success"),
            failureUrl: payuReturnUrl(booking.id, "failure"),
        });
    } else {
        const charge = await provider.createCharge({
            amountPaise: payment.amount_paise,
            receipt: `${booking.bookingNumber}-BAL`,
            bookingId: booking.id,
            customer: {},
            notes: { bookingId: booking.id, purpose: "balance" },
            successUrl: payuReturnUrl(booking.id, "success"),
            failureUrl: payuReturnUrl(booking.id, "failure"),
        });
        await db.payment.update({
            where: { id: payment.id },
            data: { gateway: wantGateway, gatewayOrderId: charge.gatewayOrderRef },
        });
        checkout = charge.checkout;
    }

    return {
        success: true,
        order: {
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            plan: "DEPOSIT",
            amountPaise: payment.amount_paise,
            checkout,
        },
    };
}
