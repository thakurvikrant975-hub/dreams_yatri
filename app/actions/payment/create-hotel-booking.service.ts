import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/app/lib/db";
import { getStayQuote } from "@/app/lib/hotel-inventory/rates";
import { createReservation } from "@/app/lib/hotel-inventory/reservations";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { rupeesToPaise } from "@/app/lib/money";
import { enabledGateways } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { checkoutSchema, type CheckoutInput } from "@/app/actions/quote/checkout-schema";
import { ensureHotelLocation } from "@/app/lib/hotel-location";
import { createOrderForBooking } from "./create-booking.service";
import type { CreateBookingOrderResult, CreateBookingResult } from "./types";

/**
 * Direct hotel-only checkout (single room, no package) — same two-step
 * pattern as create-booking.service.ts, reusing the identical gateway/finalize
 * machinery. The one thing package bookings don't need: a real inventory hold
 * (`hotel_reservation`) alongside the Booking, since this room's availability
 * is tracked by the channel-management engine, not a sales-ops itinerary.
 *
 * `holdKey` is caller-supplied (a UUID minted once per checkout attempt) and
 * doubles as the resume key: a repeat call with the same key resumes the
 * booking that key already produced, mirroring createBooking's quoteId-based
 * resume path.
 */

function genBookingNumber(): string {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `DY-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createHotelBooking(params: {
    roomId: number;
    checkIn: string; // YYYY-MM-DD
    checkOut: string; // YYYY-MM-DD (exclusive)
    units?: number;
    pricingId?: number;
    holdKey: string;
    userId: string;
    paymentChoice?: "FULL" | "DEPOSIT";
    details?: CheckoutInput;
}): Promise<CreateBookingResult> {
    const { roomId, checkIn, checkOut, holdKey, userId } = params;
    const units = params.units ?? 1;

    // ── Resume path: this holdKey already produced a booking (idempotent retry) ─
    const existingHold = await db.hotel_reservation.findUnique({
        where: { hold_key: holdKey },
        select: { booking_id: true },
    });
    if (existingHold?.booking_id) {
        const existing = await db.booking.findUnique({
            where: { id: existingHold.booking_id },
            select: { id: true, userId: true, bookingNumber: true },
        });
        if (existing) {
            if (existing.userId !== userId) {
                return { success: false, reason: "invalid", message: "Booking belongs to another user." };
            }
            return { success: true, bookingId: existing.id, bookingNumber: existing.bookingNumber };
        }
    }

    // ── Load the room → hotel ────────────────────────────────────────────────────
    const room = await db.hotel_rooms.findUnique({
        where: { id: roomId },
        select: {
            id: true, name: true, is_active: true, is_bookable: true,
            hotel: { select: { id: true, name: true, city: true, destination_id: true } },
        },
    });
    if (!room || !room.is_active || !room.is_bookable) return { success: false, reason: "not_found" };

    // A hotel-only booking's real location lives on the hotel/Location record,
    // not the ops-curated `destinations` catalog (that's a package-browsing
    // concept hotel-connect's own onboarding never asks an owner to set) — so
    // destinationId is set opportunistically when already present and left
    // null otherwise, never blocking the booking. Best-effort: make sure the
    // hotel has a proper HOTEL-type Location row with geo-coordinates instead.
    try { await ensureHotelLocation(room.hotel.id); } catch (e) { console.error("[createHotelBooking] ensureHotelLocation failed", e); }

    // ── Server-authoritative price snapshot ─────────────────────────────────────
    const quote = await getStayQuote(roomId, checkIn, checkOut, undefined, params.pricingId);
    if (!quote.allAvailable || quote.total == null) {
        return { success: false, reason: "error", message: "Sorry, those dates are no longer available." };
    }

    // ── Validate checkout details (server-authoritative) ────────────────────────
    let validDetails: CheckoutInput | undefined;
    if (params.details) {
        const parsed = checkoutSchema.safeParse(params.details);
        if (!parsed.success) return { success: false, reason: "error", message: "Please complete traveller and contact details." };
        validDetails = parsed.data;
    }

    // ── Server-derived money + schedule ──────────────────────────────────────────
    const totalPaise = rupeesToPaise(quote.total.toString());
    const schedule = computePaymentSchedule({ totalPaise, travelDate: checkIn, now: new Date() });

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

    const startDate = new Date(`${checkIn}T00:00:00.000Z`);
    const endDate = new Date(`${checkOut}T00:00:00.000Z`);
    const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
    const balanceRupees = (effBalancePaise / 100).toFixed(2);
    const nightlyRupees = quote.nights[0]?.price ?? quote.total / nights;
    const gateway: GatewayId = enabledGateways()[0];

    // ── Create booking + hotel leg + legs + PENDING payment (atomic) ────────────
    const created = await db.$transaction(async (tx) => {
        const booking = await tx.booking.create({
            data: {
                bookingNumber: genBookingNumber(),
                userId,
                packageId: null,
                destinationId: room.hotel.destination_id,
                tripType: "Leisure", // matches the package flow's own placeholder; not payment-critical
                startDate,
                endDate,
                duration: nights,
                travellers: validDetails?.travellers.length ?? 1,
                totalAmount: quote.total!.toString(),
                totalAmount_paise: totalPaise,
                advanceAmount_paise: effDepositPaise,
                balanceAmount_paise: effBalancePaise,
                balanceDueAmount: balanceRupees,
                balanceDueDate: effBalanceDue ? new Date(`${effBalanceDue}T00:00:00.000Z`) : null,
                currency: "INR",
                paymentPlan: effPlan,
                paymentStatus: "PENDING",
                priceSnapshot: quote.nights as unknown as object,
                packageUrl: null,
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
                hotelBookings: {
                    create: {
                        dayNumber: 1,
                        cityName: room.hotel.city ?? room.hotel.name,
                        checkInDate: startDate,
                        checkOutDate: endDate,
                        hotelId: room.hotel.id,
                        roomType: room.name,
                        roomsCount: units,
                        ratePerRoom: nightlyRupees.toFixed(2),
                        totalCost: quote.total!.toFixed(2),
                    },
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
                idempotencyKey: `hotel:${holdKey}:${firstLeg.type}`,
            },
        });

        return { bookingId: booking.id, bookingNumber: booking.bookingNumber };
    });

    // ── Real inventory hold — owns its own transaction, so it runs after the
    // Booking commits. On failure (sold out between quote and commit), the
    // Booking/Payment/BookingHotel rows are compensating-deleted below. ────────
    const hold = await createReservation({
        roomId,
        checkIn,
        checkOut,
        units,
        holdKey,
        source: "direct",
        status: "HELD",
        guest: validDetails
            ? {
                  name: `${validDetails.travellers[0]?.firstName ?? ""} ${validDetails.travellers[0]?.lastName ?? ""}`.trim(),
                  email: validDetails.contact.email,
                  phone: validDetails.contact.phone,
              }
            : undefined,
        money: { currency: "INR", gross: quote.total },
        bookingId: created.bookingId,
    });

    if (!hold.ok) {
        await db.$transaction(async (tx) => {
            await tx.payment.deleteMany({ where: { bookingId: created.bookingId } });
            await tx.bookingTraveller.deleteMany({ where: { bookingId: created.bookingId } });
            await tx.bookingHotel.deleteMany({ where: { bookingId: created.bookingId } });
            await tx.paymentInstallment.deleteMany({ where: { bookingId: created.bookingId } });
            await tx.booking.delete({ where: { id: created.bookingId } });
        });
        return { success: false, reason: "error", message: "Sorry, those dates are no longer available." };
    }

    return { success: true, bookingId: created.bookingId, bookingNumber: created.bookingNumber };
}

/** Single-shot — create the hotel booking and its gateway order together. */
export async function createHotelBookingAndOrder(params: Parameters<typeof createHotelBooking>[0] & {
    gateway?: GatewayId;
}): Promise<CreateBookingOrderResult> {
    const booking = await createHotelBooking(params);
    if (!booking.success) return { success: false, reason: booking.reason, message: booking.message };
    return createOrderForBooking({ bookingId: booking.bookingId, userId: params.userId, gateway: params.gateway });
}
