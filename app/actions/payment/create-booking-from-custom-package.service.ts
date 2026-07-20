import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/app/lib/db";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { rupeesToPaise } from "@/app/lib/money";
import { enabledGateways } from "@/app/lib/payments/registry";
import type { CreateBookingResult } from "./types";

function genBookingNumber(): string {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `DY-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * Custom-package equivalent of createBooking (create-booking.service.ts) —
 * Step 1 of checkout for a package the sales exec already priced and locked,
 * instead of a catalog package_quote. There's no pricing to (re)compute here:
 * custom_packages.totalPrice is already the frozen, final amount. Everything
 * downstream of a Booking existing — createOrderForBooking, the gateway/
 * webhook pipeline, /bookings/[id]/pay and the confirmation page — is reused
 * completely unmodified once this returns.
 *
 * Mirrors the destination-resolution/fixed-price pattern already proven in
 * app/lib/bookings/create-from-query.ts's tryCreateBookingFromConvertedQuery,
 * taken one step further into an actually-payable booking (+ installments +
 * a PENDING Payment row) rather than an ops-only review shell.
 */
export async function createBookingFromCustomPackage(params: {
    customPackageId: string;
    userId: string;
}): Promise<CreateBookingResult> {
    const { customPackageId, userId } = params;

    const cp = await db.custom_packages.findUnique({
        where: { id: customPackageId },
        include: { query: { select: { id: true, name: true, phone: true, countryCode: true, email: true } } },
    });
    if (!cp) return { success: false, reason: "not_found" };

    // ── Resume path: this custom package already became a booking ─────────────
    // sourceQueryId is @unique on Booking, and custom_packages.queryId is
    // @unique too — that pairing is already a clean 1:1 idempotency key, no
    // new column needed.
    const existing = await db.booking.findUnique({
        where: { sourceQueryId: cp.queryId },
        select: { id: true, userId: true, bookingNumber: true },
    });
    if (existing) {
        if (existing.userId !== userId) {
            return { success: false, reason: "invalid", message: "Booking belongs to another user." };
        }
        return { success: true, bookingId: existing.id, bookingNumber: existing.bookingNumber };
    }

    // ── Gate: same visibility rule getSharedPackage already enforces, plus a
    // fully-priced, dated package (both required to compute a payment schedule) ──
    if (cp.status !== "SENT") return { success: false, reason: "not_found" };
    if (cp.totalPrice == null || cp.totalPrice <= 0) {
        return { success: false, reason: "error", message: "This package doesn't have a price set yet — please contact your travel manager." };
    }
    if (!cp.travelDate) {
        return { success: false, reason: "error", message: "This package doesn't have a travel date set yet — please contact your travel manager." };
    }

    // ── Destination resolution — same two-step fuzzy match as
    // tryCreateBookingFromConvertedQuery: exact match first, then contains.
    // Bail out with a clear message rather than fabricating a destination. ──
    const destinationName = cp.destination.split(",")[0]?.trim();
    const destination = destinationName
        ? (await db.destinations.findFirst({ where: { name: { equals: destinationName, mode: "insensitive" } } }))
            ?? (await db.destinations.findFirst({ where: { name: { contains: destinationName, mode: "insensitive" } } }))
        : null;
    if (!destination) {
        return { success: false, reason: "error", message: "This package isn't ready for online payment yet — please contact your travel manager." };
    }

    // ── Server-derived payment schedule — same pure-function call createBooking
    // makes, same global deposit/cutoff config, no per-package override. ──
    const totalPaise = rupeesToPaise(cp.totalPrice);
    const schedule = computePaymentSchedule({ totalPaise, travelDate: isoDate(cp.travelDate) });

    const useFull = schedule.plan === "FULL";
    const todayISO = schedule.installments[0].dueDate;
    const effPlan: "FULL" | "DEPOSIT" = useFull ? "FULL" : "DEPOSIT";
    const effDepositPaise = useFull ? totalPaise : schedule.depositPaise;
    const effBalancePaise = useFull ? 0 : schedule.balancePaise;
    const effBalanceDue = useFull ? null : schedule.balanceDueDate;
    const effInstallments = useFull
        ? [{ type: "DEPOSIT" as const, sequence: 0, amountPaise: totalPaise, dueDate: todayISO }]
        : schedule.installments;
    const firstLeg = effInstallments[0];

    const startDate = new Date(`${isoDate(cp.travelDate)}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + cp.totalDays * 86_400_000);
    const balanceRupees = (effBalancePaise / 100).toFixed(2);
    // Default gateway for the PENDING payment; the customer picks the real one
    // at the pay step (createOrderForBooking, unchanged), which may switch it.
    const gateway = enabledGateways()[0];

    const created = await db.$transaction(async (tx) => {
        const booking = await tx.booking.create({
            data: {
                bookingNumber: genBookingNumber(),
                userId,
                destinationId: destination.id,
                tripType: "Leisure",
                startDate,
                endDate,
                duration: cp.totalDays,
                travellers: cp.adults + cp.children + cp.infants,
                totalAmount: cp.totalPrice!.toString(),
                totalAmount_paise: totalPaise,
                advanceAmount_paise: effDepositPaise,
                balanceAmount_paise: effBalancePaise,
                balanceDueAmount: balanceRupees,
                balanceDueDate: effBalanceDue ? new Date(`${effBalanceDue}T00:00:00.000Z`) : null,
                currency: cp.currency,
                paymentPlan: effPlan,
                paymentStatus: "PENDING",
                priceSnapshot: cp.pricingSnapshot ?? undefined,
                packageUrl: `/custom-package/${cp.id}`,
                sourceQueryId: cp.queryId,
                convertedAt: new Date(),
                contactEmail: cp.query.email ?? undefined,
                contactPhone: cp.query.phone ?? undefined,
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

        await tx.payment.create({
            data: {
                bookingId: booking.id,
                userId,
                amount: (firstLeg.amountPaise / 100).toFixed(2),
                amount_paise: firstLeg.amountPaise,
                gateway,
                status: "PENDING",
                idempotencyKey: `custom-package:${cp.id}:${firstLeg.type}`,
            },
        });

        return { bookingId: booking.id, bookingNumber: booking.bookingNumber };
    });

    return { success: true, bookingId: created.bookingId, bookingNumber: created.bookingNumber };
}
