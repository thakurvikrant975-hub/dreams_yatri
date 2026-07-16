import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/app/lib/db";
import { getQuote, isQuoteFresh } from "@/app/actions/quote/get-quote.service";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { rupeesToPaise } from "@/app/lib/money";
import { getProvider, enabledGateways } from "@/app/lib/payments/registry";
import type { CheckoutInit, GatewayId } from "@/app/lib/payments/types";
import { checkoutSchema, type CheckoutInput } from "@/app/actions/quote/checkout-schema";
import type { CreateBookingOrderResult, CreateBookingResult } from "./types";

/**
 * Two-step (MMT-style) checkout:
 *
 *   1. `createBooking`        — turn an ACTIVE + fresh quote into a Booking
 *                               (+ installment legs, quote→CONSUMED, a PENDING
 *                               Payment with the *default* gateway and NO charge
 *                               yet). This is what "Proceed to Payment" calls;
 *                               the customer then lands on the payment page.
 *   2. `createOrderForBooking`— on the payment page, the customer picks a gateway;
 *                               this creates (or rebuilds/switches) the gateway
 *                               charge for the pending first leg and returns what
 *                               the browser launches.
 *
 * `createBookingAndOrder` composes both in one shot (tests / back-compat).
 *
 * Server-authoritative: the amount comes from the quote total + Phase-3 policy,
 * never the client. The gateway charge is created OUTSIDE the DB transaction
 * (no network call inside a tx). Idempotent: a quote already turned into a
 * booking is resumed, so retries — and the already-CONSUMED quote — never
 * duplicate a booking (Booking.quoteId @unique).
 */

function genBookingNumber(): string {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `DY-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Absolute return URL for redirect-based gateways (PayU surl/furl). */
export function payuReturnUrl(bookingId: string, kind: "success" | "failure"): string {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    return `${base}/api/payments/payu/callback?b=${bookingId}&k=${kind}`;
}

// ── Step 1 — create the Booking (no gateway charge) ────────────────────────────
export async function createBooking(params: {
    quoteId: string;
    userId: string;
    /** User's choice when a deposit is allowed. Near-travel always forces FULL. Default: DEPOSIT (policy decides). */
    paymentChoice?: "FULL" | "DEPOSIT";
    /** Traveller + contact (+ optional GST) details collected at checkout. */
    details?: CheckoutInput;
}): Promise<CreateBookingResult> {
    const { quoteId, userId } = params;

    // ── Resume path: this quote already became a booking (idempotent retry) ────
    const existing = await db.booking.findUnique({
        where: { quoteId },
        select: { id: true, userId: true, bookingNumber: true },
    });
    if (existing) {
        if (existing.userId !== userId) {
            return { success: false, reason: "invalid", message: "Booking belongs to another user." };
        }
        return { success: true, bookingId: existing.id, bookingNumber: existing.bookingNumber };
    }

    // ── Gate: quote must verify, be ACTIVE, and still be fresh ─────────────────
    const gate = await getQuote(quoteId);
    if (!gate.success) return { success: false, reason: gate.reason };
    if (gate.quote.status !== "ACTIVE") return { success: false, reason: "not_active" };
    const fresh = await isQuoteFresh(quoteId);
    if (!fresh || !fresh.fresh) return { success: false, reason: "stale" };

    // ── Load the raw quote row (ids + frozen breakdown) + package/duration ─────
    const row = await db.package_quote.findUnique({ where: { id: quoteId } });
    if (!row) return { success: false, reason: "not_found" };

    const [pkg, dur] = await Promise.all([
        db.packages.findUnique({ where: { id: row.package_id }, select: { id: true, destination_id: true } }),
        db.package_durations.findUnique({ where: { id: row.duration_id }, select: { days: true, nights: true } }),
    ]);
    if (!pkg || !dur) return { success: false, reason: "error", message: "Package or duration not found." };

    // ── Validate checkout details (server-authoritative) ───────────────────────
    let validDetails: CheckoutInput | undefined;
    if (params.details) {
        const parsed = checkoutSchema.safeParse(params.details);
        if (!parsed.success) return { success: false, reason: "error", message: "Please complete traveller and contact details." };
        const expectedPax = row.adults + row.children + row.infants;
        if (parsed.data.travellers.length !== expectedPax) {
            return { success: false, reason: "error", message: `Please add details for all ${expectedPax} travellers.` };
        }
        validDetails = parsed.data;
    }

    // ── Server-derived money + schedule ────────────────────────────────────────
    const totalPaise = rupeesToPaise(row.total_amount.toString());
    const schedule = computePaymentSchedule({ totalPaise, travelDate: isoDate(row.travel_date), now: new Date() });

    // Honour the user's payment choice: FULL is always allowed; DEPOSIT only when the
    // policy allows it (far enough). Near-travel (schedule.plan === FULL) forces FULL.
    const useFull = params.paymentChoice === "FULL" || schedule.plan === "FULL";
    const todayISO = schedule.installments[0].dueDate;
    const effPlan: "FULL" | "DEPOSIT" = useFull ? "FULL" : "DEPOSIT";
    const effDepositPaise = useFull ? totalPaise : schedule.depositPaise;
    const effBalancePaise = useFull ? 0 : schedule.balancePaise;
    const effBalanceDue = useFull ? null : schedule.balanceDueDate;
    const effInstallments = useFull
        ? [{ type: "DEPOSIT" as const, sequence: 0, amountPaise: totalPaise, dueDate: todayISO }]
        : schedule.installments;
    const firstLeg = effInstallments[0];

    const startDate = new Date(`${isoDate(row.travel_date)}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + dur.nights * 86_400_000);
    const balanceRupees = (effBalancePaise / 100).toFixed(2);
    // Default gateway for the PENDING payment; the customer picks the real one at
    // the pay step (createOrderForBooking), which may switch it before any charge.
    const gateway: GatewayId = enabledGateways()[0];

    // ── Create booking + legs + PENDING payment; consume quote (atomic) ────────
    const created = await db.$transaction(async (tx) => {
        const booking = await tx.booking.create({
            data: {
                bookingNumber: genBookingNumber(),
                userId,
                packageId: pkg.id,
                destinationId: pkg.destination_id,
                tripType: "Leisure", // TODO: infer from package; not payment-critical
                startDate,
                endDate,
                duration: dur.days,
                travellers: row.adults + row.children + row.infants,
                totalAmount: row.total_amount.toString(),
                totalAmount_paise: totalPaise,
                advanceAmount_paise: effDepositPaise,
                balanceAmount_paise: effBalancePaise,
                balanceDueAmount: balanceRupees,
                balanceDueDate: effBalanceDue ? new Date(`${effBalanceDue}T00:00:00.000Z`) : null,
                currency: row.currency,
                paymentPlan: effPlan,
                paymentStatus: "PENDING",
                priceSnapshot: row.breakdown as object,
                packageUrl: `/packages/${row.package_slug}/${row.duration_slug}/${row.route_slug}/${row.stay_slug}`,
                quoteId,
                quoteInputsHash: row.inputs_hash,
                contactEmail: validDetails?.contact.email ?? null,
                contactPhone: validDetails?.contact.phone ?? null,
                gstStateCode: validDetails?.gstStateCode || null,
                notes: validDetails?.specialRequests || null,
                travellersList: validDetails
                    ? {
                          create: validDetails.travellers.map((t, i) => ({
                              type: t.type,
                              fullName: `${t.title ?? "Mr"}. ${t.firstName} ${t.lastName}`.trim(),
                              firstName: t.firstName,
                              lastName: t.lastName,
                              dateOfBirth: new Date(`${t.dob}T00:00:00.000Z`),
                              gender: t.gender,
                              isLead: i === 0,
                          })),
                      }
                    : undefined,
                installments: {
                    create: effInstallments.map((l) => ({
                        type: l.type,
                        sequence: l.sequence,
                        amount_paise: l.amountPaise,
                        dueDate: new Date(`${l.dueDate}T00:00:00.000Z`),
                        status: "PENDING" as const,
                    })),
                },
            },
            select: { id: true, bookingNumber: true },
        });

        await tx.package_quote.update({ where: { id: quoteId }, data: { status: "CONSUMED" } });

        await tx.payment.create({
            data: {
                bookingId: booking.id,
                userId,
                amount: (firstLeg.amountPaise / 100).toFixed(2),
                amount_paise: firstLeg.amountPaise,
                gateway,
                status: "PENDING",
                idempotencyKey: `quote:${quoteId}:${firstLeg.type}`,
            },
        });

        return { bookingId: booking.id, bookingNumber: booking.bookingNumber };
    });

    return { success: true, bookingId: created.bookingId, bookingNumber: created.bookingNumber };
}

// ── Step 2 — create the gateway charge for the booking's pending first leg ──────
export async function createOrderForBooking(params: {
    bookingId: string;
    userId: string;
    /** Customer-chosen gateway (must be enabled). Honoured while no charge exists, or to switch gateways before paying. */
    gateway?: GatewayId;
}): Promise<CreateBookingOrderResult> {
    const booking = await db.booking.findUnique({
        where: { id: params.bookingId },
        select: { id: true, userId: true, bookingNumber: true, paymentPlan: true, currency: true, paymentStatus: true, advanceAmount_paise: true },
    });
    if (!booking) return { success: false, reason: "not_found" };
    if (booking.userId !== params.userId) {
        return { success: false, reason: "invalid", message: "Booking belongs to another user." };
    }
    if (booking.paymentStatus !== "PENDING") {
        return { success: false, reason: "error", message: "This booking has already been paid." };
    }

    const enabled = enabledGateways();
    const defaultGateway: GatewayId = enabled[0];

    // The initial-leg payments, newest first. A booking can have several if earlier
    // attempts failed (e.g. a declined card); we never charge twice once one succeeds.
    const inits = await db.payment.findMany({
        where: { bookingId: booking.id, purpose: "INITIAL" },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, gateway: true, amount_paise: true, gatewayOrderId: true },
    });
    if (inits.some((p) => p.status === "ADVANCE_PAID" || p.status === "FULLY_PAID")) {
        return { success: false, reason: "error", message: "This booking has already been paid." };
    }

    // Reuse the open PENDING leg if there is one; otherwise the last attempt failed
    // (or none exists) — start a fresh PENDING leg so the customer can try again.
    let payment = inits.find((p) => p.status === "PENDING") ?? null;
    if (!payment) {
        const amountPaise = inits[0]?.amount_paise ?? booking.advanceAmount_paise;
        payment = await db.payment.create({
            data: {
                bookingId: booking.id,
                userId: booking.userId,
                amount: (amountPaise / 100).toFixed(2),
                amount_paise: amountPaise,
                gateway: params.gateway && enabled.includes(params.gateway) ? params.gateway : defaultGateway,
                status: "PENDING",
                purpose: "INITIAL",
                idempotencyKey: `booking:${booking.id}:initial:${randomBytes(4).toString("hex")}`,
            },
            select: { id: true, status: true, gateway: true, amount_paise: true, gatewayOrderId: true },
        });
    }

    // Which gateway to charge on: the customer's pick (if enabled), else the one
    // already on the payment. We reuse an existing charge only when it's for the
    // *same* gateway; switching gateways (before capture) builds a fresh charge.
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
        });
    } else {
        const charge = await provider.createCharge({
            amountPaise: payment.amount_paise,
            receipt: booking.bookingNumber,
            bookingId: booking.id,
            customer: {},
            notes: { bookingId: booking.id },
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
            plan: booking.paymentPlan ?? "FULL",
            amountPaise: payment.amount_paise,
            checkout,
        },
    };
}

// ── Single-shot — create booking + order together (tests / back-compat) ─────────
export async function createBookingAndOrder(params: {
    quoteId: string;
    userId: string;
    paymentChoice?: "FULL" | "DEPOSIT";
    details?: CheckoutInput;
    gateway?: GatewayId;
}): Promise<CreateBookingOrderResult> {
    const booking = await createBooking(params);
    if (!booking.success) return { success: false, reason: booking.reason, message: booking.message };
    return createOrderForBooking({ bookingId: booking.bookingId, userId: params.userId, gateway: params.gateway });
}
