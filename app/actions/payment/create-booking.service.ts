import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/app/lib/db";
import { getQuote, isQuoteFresh } from "@/app/actions/quote/get-quote.service";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { rupeesToPaise } from "@/app/lib/money";
import { getProvider, enabledGateways } from "@/app/lib/payments/registry";
import type { CheckoutInit, GatewayId } from "@/app/lib/payments/types";
import { checkoutSchema, type CheckoutInput } from "@/app/actions/quote/checkout-schema";
import type { CreateBookingOrderResult } from "./types";

/**
 * Turn an ACTIVE + fresh quote into a Booking (+ installment legs, quote→CONSUMED,
 * a PENDING Payment) and a gateway charge for the FIRST leg (deposit, or full),
 * via the active PaymentProvider.
 *
 * Server-authoritative: the amount comes from the quote total + Phase-3 policy,
 * never the client. The gateway charge is created OUTSIDE the DB transaction
 * (no network call inside a tx). Idempotent: a quote already turned into a
 * booking is resumed (its pending charge rebuilt), so retries — and the
 * already-CONSUMED quote — never duplicate a booking (Booking.quoteId @unique).
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
function payuReturnUrl(bookingId: string, kind: "success" | "failure"): string {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    return `${base}/api/payments/payu/callback?b=${bookingId}&k=${kind}`;
}

export async function createBookingAndOrder(params: {
    quoteId: string;
    userId: string;
    /** User's choice when a deposit is allowed. Near-travel always forces FULL. Default: DEPOSIT (policy decides). */
    paymentChoice?: "FULL" | "DEPOSIT";
    /** Traveller + contact (+ optional GST) details collected at checkout. */
    details?: CheckoutInput;
    /** Customer-chosen gateway (must be enabled); defaults to the first enabled. */
    gateway?: GatewayId;
}): Promise<CreateBookingOrderResult> {
    const { quoteId, userId } = params;

    // ── Resume path: this quote already became a booking (idempotent retry) ────
    const existing = await db.booking.findUnique({
        where: { quoteId },
        select: { id: true, userId: true, bookingNumber: true, paymentPlan: true, currency: true },
    });
    if (existing) {
        if (existing.userId !== userId) {
            return { success: false, reason: "invalid", message: "Booking belongs to another user." };
        }
        const payment = await db.payment.findFirst({
            where: { bookingId: existing.id, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            select: { id: true, gateway: true, amount_paise: true, gatewayOrderId: true },
        });
        if (!payment) return { success: false, reason: "error", message: "No pending payment to resume." };

        const provider = getProvider(payment.gateway);
        let checkout: CheckoutInit;
        if (payment.gatewayOrderId) {
            checkout = provider.checkoutForExistingOrder({ gatewayOrderRef: payment.gatewayOrderId, amountPaise: payment.amount_paise, currency: existing.currency });
        } else {
            const charge = await provider.createCharge({
                amountPaise: payment.amount_paise, receipt: existing.bookingNumber, bookingId: existing.id,
                customer: {}, notes: { quoteId, bookingId: existing.id },
                successUrl: payuReturnUrl(existing.id, "success"), failureUrl: payuReturnUrl(existing.id, "failure"),
            });
            await db.payment.update({ where: { id: payment.id }, data: { gatewayOrderId: charge.gatewayOrderRef } });
            checkout = charge.checkout;
        }
        return {
            success: true,
            order: {
                bookingId: existing.id,
                bookingNumber: existing.bookingNumber,
                plan: existing.paymentPlan ?? "FULL",
                amountPaise: payment.amount_paise,
                checkout,
            },
        };
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
    const enabled = enabledGateways();
    const gateway: GatewayId = params.gateway && enabled.includes(params.gateway) ? params.gateway : enabled[0];

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
                quoteId,
                quoteInputsHash: row.inputs_hash,
                contactEmail: validDetails?.contact.email ?? null,
                contactPhone: validDetails?.contact.phone ?? null,
                gstStateCode: validDetails?.gstStateCode || null,
                travellersList: validDetails
                    ? {
                          create: validDetails.travellers.map((t, i) => ({
                              type: t.type,
                              fullName: `${t.firstName} ${t.lastName}`.trim(),
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

        const payment = await tx.payment.create({
            data: {
                bookingId: booking.id,
                userId,
                amount: (firstLeg.amountPaise / 100).toFixed(2),
                amount_paise: firstLeg.amountPaise,
                gateway,
                status: "PENDING",
                idempotencyKey: `quote:${quoteId}:${firstLeg.type}`,
            },
            select: { id: true },
        });

        return { bookingId: booking.id, bookingNumber: booking.bookingNumber, paymentId: payment.id };
    });

    // ── Gateway charge (outside the tx) ────────────────────────────────────────
    const charge = await getProvider(gateway).createCharge({
        amountPaise: firstLeg.amountPaise,
        receipt: created.bookingNumber,
        bookingId: created.bookingId,
        customer: {},
        notes: { quoteId, bookingId: created.bookingId },
        successUrl: payuReturnUrl(created.bookingId, "success"),
        failureUrl: payuReturnUrl(created.bookingId, "failure"),
    });
    await db.payment.update({ where: { id: created.paymentId }, data: { gatewayOrderId: charge.gatewayOrderRef } });

    return {
        success: true,
        order: {
            bookingId: created.bookingId,
            bookingNumber: created.bookingNumber,
            plan: schedule.plan,
            amountPaise: firstLeg.amountPaise,
            checkout: charge.checkout,
        },
    };
}
