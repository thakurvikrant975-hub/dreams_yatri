import { getDb } from "./db.mjs";
import { ensureCustomerUser } from "./auth.mjs";

export const E2E_BOOKING_ID = "e2e-fixture-booking-001";
export const E2E_HOTEL_SLUG = "e2e-fixture-hotel";
export const E2E_BOOKING_NUMBER = "E2E-FIXTURE-001";

// Separate from E2E_BOOKING_ID on purpose — the cancellation spec actually
// mutates this one (CONFIRMED → CANCELLED), so it can't share a booking with
// the read-only list/detail/invoice/voucher specs without an execution-order
// dependency between spec files.
export const E2E_CANCELLABLE_BOOKING_ID = "e2e-fixture-booking-002";
export const E2E_CANCELLABLE_BOOKING_NUMBER = "E2E-FIXTURE-002";

function daysFromNow(n: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
}

/** Idempotent — (re)creates one complete hotel-only booking (2-night stay at
 * the same hotel across 2 day-rows, a 3-leg cab hire, one FULLY_PAID payment,
 * two travellers) so the dashboard package-bookings list/detail/invoice/
 * voucher pages have real, deterministic data to render in CI, without
 * depending on whatever happens to already be in the target database.
 *
 * Deletes-then-recreates rather than upserting nested relations, since
 * Payment→Booking has no cascade delete — explicit child cleanup first
 * keeps this safe to re-run against a DB that already has the fixture. */
export async function ensureE2EBooking() {
    const db = await getDb();
    const user = await ensureCustomerUser();

    const hotel = await db.hotels.upsert({
        where: { slug: E2E_HOTEL_SLUG },
        update: {},
        create: {
            name: "E2E Fixture Hotel", slug: E2E_HOTEL_SLUG, city: "Port Blair", state: "Andaman and Nicobar Islands",
            listing_status: "LIVE", is_active: true,
        },
    });

    await db.payment.deleteMany({ where: { bookingId: E2E_BOOKING_ID } });
    await db.bookingTraveller.deleteMany({ where: { bookingId: E2E_BOOKING_ID } });
    await db.bookingHotel.deleteMany({ where: { bookingId: E2E_BOOKING_ID } });
    await db.bookingCab.deleteMany({ where: { bookingId: E2E_BOOKING_ID } });
    await db.bookingTimeline.deleteMany({ where: { bookingId: E2E_BOOKING_ID } }).catch(() => {});
    await db.booking.deleteMany({ where: { id: E2E_BOOKING_ID } });

    const checkIn = daysFromNow(30);
    const mid = daysFromNow(31);
    const checkOut = daysFromNow(32);

    const booking = await db.booking.create({
        data: {
            id: E2E_BOOKING_ID,
            bookingNumber: E2E_BOOKING_NUMBER,
            userId: user.id,
            tripType: "Leisure",
            startDate: checkIn,
            endDate: checkOut,
            duration: 3,
            travellers: 2,
            status: "CONFIRMED",
            totalAmount: 21787.50,
            totalAmount_paise: 2178750,
            advanceAmount_paise: 1000000,
            balanceAmount_paise: 1178750,
            paymentPlan: "DEPOSIT",
            paymentStatus: "ADVANCE_PAID",
            contactEmail: "e2e-customer@dreamsyatri.internal",
            contactPhone: "+910000000000",
            hotelBookings: {
                create: [
                    {
                        dayNumber: 1, cityName: "Port Blair", checkInDate: checkIn, checkOutDate: mid,
                        hotelId: hotel.id, roomType: "DELUXE ROOM", roomsCount: 1,
                        ratePerRoom: 2300, totalCost: 2300, isConfirmed: true, status: "CONFIRMED",
                    },
                    {
                        dayNumber: 2, cityName: "Port Blair", checkInDate: mid, checkOutDate: checkOut,
                        hotelId: hotel.id, roomType: "DELUXE ROOM", roomsCount: 1,
                        ratePerRoom: 2300, totalCost: 2300, isConfirmed: true, status: "CONFIRMED",
                    },
                ],
            },
            cabBookings: {
                create: [
                    { legNumber: 1, fromLocation: "Port Blair", toLocation: "Port Blair", transferDate: checkIn, cabType: "INNOVA", capacity: 6, ratePerCab: 4000, totalCost: 4000, isConfirmed: true, status: "CONFIRMED" },
                    { legNumber: 2, fromLocation: "Port Blair", toLocation: "Port Blair", transferDate: mid, cabType: "INNOVA", capacity: 6, ratePerCab: 4000, totalCost: 4000, isConfirmed: true, status: "CONFIRMED" },
                    { legNumber: 3, fromLocation: "Port Blair", toLocation: "Port Blair", transferDate: checkOut, cabType: "INNOVA", capacity: 6, ratePerCab: 4000, totalCost: 4000, isConfirmed: true, status: "CONFIRMED" },
                ],
            },
            travellersList: {
                create: [
                    { type: "ADULT", fullName: "E2E Lead Traveller", firstName: "E2E", lastName: "Lead", isLead: true },
                    { type: "ADULT", fullName: "E2E Second Traveller", firstName: "E2E", lastName: "Second", isLead: false },
                ],
            },
            payments: {
                create: [
                    {
                        userId: user.id, amount: 10000, gateway: "RAZORPAY", method: "CARD",
                        status: "FULLY_PAID", purpose: "INITIAL", amount_paise: 1000000, paidAt: new Date(),
                        gatewayPaymentId: `pay_e2e_fixture_${E2E_BOOKING_ID}`,
                    },
                ],
            },
        },
    });

    return booking;
}

/** A second, minimal fixture reserved for the destructive cancel-booking
 * spec — deliberately disjoint from ensureE2EBooking()'s CONFIRMED booking
 * so cancelling it can't affect the read-only specs' assumptions.
 *
 * Deliberately has NO FULLY_PAID payment: cancelBooking() only calls out to
 * the real gateway's refund() for `status === "FULLY_PAID"` payments, and a
 * fixture can't have a genuine Razorpay payment behind it — refund-flow
 * correctness has its own dedicated unit coverage (test:razorpay,
 * test:payments); this spec is testing the cancel UI/mechanism, so a
 * zero-paid booking exercises the exact same code path without depending on
 * an external gateway. */
export async function ensureE2ECancellableBooking() {
    const db = await getDb();
    const user = await ensureCustomerUser();

    await db.payment.deleteMany({ where: { bookingId: E2E_CANCELLABLE_BOOKING_ID } });
    await db.booking.deleteMany({ where: { id: E2E_CANCELLABLE_BOOKING_ID } });

    const startDate = daysFromNow(45);
    const endDate = daysFromNow(47);

    return db.booking.create({
        data: {
            id: E2E_CANCELLABLE_BOOKING_ID,
            bookingNumber: E2E_CANCELLABLE_BOOKING_NUMBER,
            userId: user.id,
            tripType: "Leisure",
            startDate, endDate, duration: 2, travellers: 1,
            status: "CONFIRMED",
            totalAmount: 5000,
            totalAmount_paise: 500000,
            paymentPlan: "FULL",
            paymentStatus: "PENDING",
            contactEmail: "e2e-customer@dreamsyatri.internal",
            contactPhone: "+910000000000",
        },
    });
}
