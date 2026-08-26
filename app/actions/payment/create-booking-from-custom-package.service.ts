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
    /** Which stay option the client chose, on a package quoting several.
     * Absent means the recommended one. Validated against the package rather
     * than trusted: it arrives from a public page and decides what is charged. */
    stayOptionId?: string | null;
    /** What the client chose on the review step. Absent means take the
     * schedule's own answer, which is what the flow did before there was a
     * review step to choose on. */
    paymentChoice?: "FULL" | "DEPOSIT";
    /** The package total the client was shown on the review step, in rupees.
     * Not used to price anything — the price still comes from the database —
     * but compared against it, so a booking cannot be taken at an amount the
     * client never saw. Absent skips the check, for callers with nothing to
     * compare. */
    expectedTotal?: number | null;
}): Promise<CreateBookingResult> {
    const { customPackageId, userId, stayOptionId } = params;

    const cp = await db.custom_packages.findUnique({
        where: { id: customPackageId },
        include: { query: { select: { id: true, name: true, phone: true, countryCode: true, email: true, assignedTo: true, assignedToName: true } } },
    });
    // A "blank" package with no linked query has no client to book for, and
    // can never reach SENT (see sendPackageToClient) — bail the same as a
    // missing package rather than continuing with no contact info.
    if (!cp || !cp.query) return { success: false, reason: "not_found" };
    // Narrowed once here so it survives capture inside the $transaction
    // closure below (property narrowing on `cp.query` doesn't).
    const query = cp.query;

    // ── Resume path ───────────────────────────────────────────────────────────
    // sourceQueryId is @unique on Booking, so there is at most one booking per
    // QUERY — and a query can carry several packages, which is the whole point
    // of quoting a client two ways.
    //
    // That made this dangerous. Any booking on the query answered for every
    // package on it, so a client holding quote B pressed Book and was handed
    // quote A's booking: a payment page for an itinerary they had not read, at
    // a price they had not agreed. Silently, and 49 queries in production have
    // more than one sent quote.
    //
    // packageUrl records which package a booking actually came from, so the
    // two cases can be told apart. Same package is a genuine resume — an
    // abandoned payment, a second tab — and returns the booking as before. A
    // different package is refused and says so, because one trip is one
    // booking and the client needs to know the first one exists rather than
    // be quietly redirected into it.
    const thisPackageUrl = `/custom-package/${cp.id}`;
    const existing = await db.booking.findUnique({
        where: { sourceQueryId: query.id },
        select: { id: true, userId: true, bookingNumber: true, packageUrl: true },
    });
    if (existing) {
        if (existing.userId !== userId) {
            return { success: false, reason: "invalid", message: "Booking belongs to another user." };
        }
        if (existing.packageUrl && existing.packageUrl !== thisPackageUrl) {
            return {
                success: false,
                reason: "invalid",
                message: "You already have a booking for this trip, made from a different quote. Open it from My Bookings, or ask your travel manager to change it.",
            };
        }
        return { success: true, bookingId: existing.id, bookingNumber: existing.bookingNumber };
    }

    // ── Gate: same visibility rule getSharedPackage already enforces, plus a
    // fully-priced, dated package (both required to compute a payment schedule) ──
    if (cp.status !== "SENT") return { success: false, reason: "not_found" };

    // ── The chosen stay option ──────────────────────────────────────────────
    // Its price, not the package's, is what the client agreed to when they
    // picked one out of the comparison. Re-read here rather than taken from the
    // request: the id comes off a public page, and the amount charged can only
    // ever come from the database.
    //
    // The stored figure is used as-is — frozen when the package went for review,
    // and what the client was shown. Recomputing at booking time would quietly
    // charge today's catalog rates for last week's quote.
    const chosenOption = stayOptionId
        ? await db.custom_package_stay_options.findFirst({
            where: { id: stayOptionId, customPackageId },
            select: { id: true, label: true, totalPrice: true, isRecommended: true },
        })
        : null;
    if (stayOptionId && !chosenOption) {
        return { success: false, reason: "error", message: "That stay option isn't available on this package any more — please refresh and try again." };
    }
    if (chosenOption && (chosenOption.totalPrice == null || chosenOption.totalPrice <= 0)) {
        return { success: false, reason: "error", message: "That option isn't priced yet — please contact your travel manager." };
    }

    // A non-recommended option is charged at its own price; the recommended one
    // keeps using the package row, which is the figure every other part of the
    // system already treats as the quote.
    const bookedPrice = chosenOption && !chosenOption.isRecommended
        ? chosenOption.totalPrice!
        : cp.totalPrice;

    // ── What the client was shown is what the client pays ─────────────────
    // The review step renders a price; this service re-reads it when the
    // button is pressed. An exec editing the package in between — which they
    // may, a sent package stays editable — moved the number underneath a
    // client who had already decided, and the first they would know of it is
    // the gateway asking for a different amount.
    //
    // The database still decides the price. This only refuses to charge one
    // the client has not seen, and sends them back to look again.
    if (
        params.expectedTotal != null &&
        bookedPrice != null &&
        Math.round(bookedPrice) !== Math.round(params.expectedTotal)
    ) {
        return {
            success: false,
            reason: "invalid",
            message: "This package's price changed while you were reviewing it. Please refresh to see the current price before paying.",
        };
    }

    if (bookedPrice == null || bookedPrice <= 0) {
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
    // No match is not a failure. Booking.destinationId is nullable, and an
    // exec types a destination as a client says it — "North Goa, South Goa",
    // "Meghalaya & Assam" — which is often nothing the catalogue has a row
    // for. Refusing on that turned away 81% of sent packages, with a message
    // that blamed the package for not being "ready for online payment" when
    // the only thing missing was a row in a table the client never sees.
    //
    // The booking carries the package's own destination text either way; the
    // id is a convenience for grouping, not a requirement for taking money.

    // ── Server-derived payment schedule — same pure-function call createBooking
    // makes, same global deposit/cutoff config, no per-package override. ──
    const totalPaise = rupeesToPaise(bookedPrice);
    const schedule = computePaymentSchedule({ totalPaise, travelDate: isoDate(cp.travelDate) });

    // The engine decides whether a deposit is ALLOWED; the client decides
    // whether to use one. Paying in full is always permitted — it is the same
    // money sooner — so a FULL choice is honoured even when the schedule would
    // have allowed a deposit. The reverse is not: a client cannot choose a
    // deposit on a booking the policy says must be paid in full.
    const useFull = schedule.plan === "FULL" || params.paymentChoice === "FULL";
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
                destinationId: destination?.id ?? null,
                tripType: "Leisure",
                startDate,
                endDate,
                duration: cp.totalDays,
                travellers: cp.adults + cp.children + cp.infants,
                totalAmount: bookedPrice.toString(),
                totalAmount_paise: totalPaise,
                advanceAmount_paise: effDepositPaise,
                balanceAmount_paise: effBalancePaise,
                balanceDueAmount: balanceRupees,
                balanceDueDate: effBalanceDue ? new Date(`${effBalanceDue}T00:00:00.000Z`) : null,
                currency: cp.currency,
                paymentPlan: effPlan,
                paymentStatus: "PENDING",
                priceSnapshot: cp.pricingSnapshot ?? undefined,
                // Also the discriminator the resume path above reads.
                packageUrl: thisPackageUrl,
                sourceQueryId: query.id,
                // Who sold it. The lead's current owner rather than whoever
                // built the package: credit follows a reassigned query, and
                // the client may book weeks after the quote was written.
                //
                // It is also what separates a sale from a website booking —
                // a booking with no sales agent came in on its own.
                salesAgentId: query.assignedTo ?? null,
                salesAgentName: query.assignedToName ?? null,
                // What was sold, frozen: the option can be renamed or removed
                // on the package afterwards, and ops needs to know which hotels
                // to hold. See the schema comment.
                stayOptionId: chosenOption?.id ?? null,
                stayOptionLabel: chosenOption?.label ?? null,
                convertedAt: new Date(),
                contactEmail: query.email ?? undefined,
                contactPhone: query.phone ?? undefined,
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
