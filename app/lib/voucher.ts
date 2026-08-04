import "server-only";
import { db } from "@/app/lib/db";

/**
 * Everything the trip voucher renders, assembled from data that already exists
 * the moment a booking is created.
 *
 * The itinerary comes from `priceSnapshot` — the pricing breakdown frozen at
 * checkout — rather than from the package's live itinerary rows. That is
 * deliberate: a package can be re-sequenced or re-hotelled after someone books
 * it, and the voucher has to keep showing the trip that was actually sold. The
 * ops tables (hotelBookings / cabBookings) are the opposite: those are live, so
 * a voucher reprinted after ops confirms a hotel shows the confirmation.
 *
 * Because nothing here waits on ops, a complete voucher exists as soon as the
 * booking row does — which is what the confirmation email links to.
 */

/** Shape of the frozen pricing breakdown we read. Mirrors FullPricingBreakdown
 *  (app/services/package-pricing.service.ts) but declares only what the voucher
 *  touches, so an unrelated change to the breakdown can't break this render. */
type SnapHotel = {
    hotel_id: number;
    hotel_name: string;
    hotel_city: string | null;
    hotel_state: string | null;
    room_name: string | null;
    plan_name: string | null;
    rooms_count: number;
    num_nights: number;
};
type SnapDay = {
    day: number;
    day_title: string;
    day_date: string | null;
    hotel: SnapHotel | null;
    meals: { label: string }[];
    activities: { name: string; is_optional: boolean }[];
};
type Snapshot = {
    duration_label?: string;
    stay_category_label?: string;
    days?: SnapDay[];
};

export type VoucherDay = {
    day: number;
    title: string;
    date: Date | null;
    hotelName: string | null;
    /** 1–5 when the hotel row carries a rating, else null — drives the stars. */
    hotelStars: number | null;
    roomLabel: string | null;
    meals: string[];
    /** The booked rate's plan name ("… with Breakfast & Dinner"). Priced meals
     *  live in `meals`, but a plan whose meals are bundled into the room rate
     *  produces no meal lines at all — the plan name is then the only record of
     *  what the guest is fed, so the table falls back to it. */
    mealPlan: string | null;
    activities: string[];
};

export type VoucherPolicy = { title: string; points: string[] };

export type VoucherData = {
    bookingId: string;
    bookingNumber: string;
    createdAt: Date;
    startDate: Date;
    endDate: Date;
    duration: number;
    travellers: number;
    tripTitle: string;
    durationLabel: string | null;
    stayLabel: string | null;
    guestName: string;
    guestContact: string | null;
    /** A direct hotel booking has no package — the itinerary, inclusions and
     *  policy sections are meaningless there and are dropped entirely. */
    isPackage: boolean;
    days: VoucherDay[];
    inclusions: string[];
    exclusions: string[];
    policies: VoucherPolicy[];
    hotels: {
        dayNumber: number;
        cityName: string;
        checkInDate: Date;
        checkOutDate: Date;
        roomType: string;
        roomsCount: number;
        isConfirmed: boolean;
        status: string;
        hotel: { name: string; city: string | null; state: string | null };
    }[];
    cabs: {
        legNumber: number;
        fromLocation: string;
        toLocation: string;
        transferDate: Date;
        cabType: string;
        cabCount: number;
        capacity: number;
        isConfirmed: boolean;
        status: string;
        driverName: string | null;
        driverPhone: string | null;
        vehicleNumber: string | null;
    }[];
};

/**
 * Load a booking's voucher data. Returns null when the booking doesn't exist, so
 * callers can `notFound()` with their own auth rules applied first.
 */
export async function getVoucherData(bookingId: string): Promise<VoucherData | null> {
    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, bookingNumber: true, createdAt: true, startDate: true, endDate: true,
            duration: true, travellers: true, packageId: true, priceSnapshot: true,
            contactPhone: true, contactEmail: true,
            user: { select: { name: true } },
            destination: { select: { name: true } },
            package: {
                select: {
                    title: true, inclusions: true, exclusions: true,
                    policies: { select: { policy: { select: { title: true, points: true, is_active: true, sort_order: true, type: true } } } },
                },
            },
            hotelBookings: {
                orderBy: { dayNumber: "asc" },
                select: {
                    dayNumber: true, cityName: true, checkInDate: true, checkOutDate: true,
                    roomType: true, roomsCount: true, isConfirmed: true, status: true,
                    hotel: { select: { name: true, city: true, state: true } },
                },
            },
            cabBookings: {
                orderBy: { legNumber: "asc" },
                select: {
                    legNumber: true, fromLocation: true, toLocation: true, transferDate: true,
                    cabType: true, cabCount: true, capacity: true, isConfirmed: true, status: true,
                    driverName: true, driverPhone: true, vehicleNumber: true,
                },
            },
        },
    });
    if (!booking) return null;

    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const snapDays = Array.isArray(snap.days) ? snap.days : [];

    // Star ratings aren't in the snapshot (they aren't a price input), so they're
    // read live off the hotels the snapshot names. A rating that changed since
    // booking is not worth freezing — it describes the property, not the deal.
    const hotelIds = [...new Set(snapDays.map((d) => d.hotel?.hotel_id).filter((id): id is number => typeof id === "number"))];
    const starsById = new Map<number, number | null>(
        hotelIds.length
            ? (await db.hotels.findMany({ where: { id: { in: hotelIds } }, select: { id: true, star_rating: true } }))
                .map((h) => [h.id, h.star_rating])
            : [],
    );

    const days: VoucherDay[] = snapDays.map((d) => {
        const stars = d.hotel ? starsById.get(d.hotel.hotel_id) ?? null : null;
        return {
            day: d.day,
            title: d.day_title,
            date: d.day_date ? new Date(d.day_date) : null,
            hotelName: d.hotel?.hotel_name ?? null,
            hotelStars: stars && stars >= 1 && stars <= 5 ? stars : null,
            roomLabel: d.hotel?.room_name ?? null,
            meals: (d.meals ?? []).map((m) => m.label).filter(Boolean),
            mealPlan: d.hotel?.plan_name ?? null,
            activities: (d.activities ?? []).map((a) => (a.is_optional ? `${a.name} (optional)` : a.name)),
        };
    });

    const policies: VoucherPolicy[] = (booking.package?.policies ?? [])
        .map((p) => p.policy)
        .filter((p) => p.is_active && p.points.length > 0)
        .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
        .map((p) => ({ title: p.title, points: p.points }));

    const contact = [booking.contactPhone, booking.contactEmail].filter(Boolean).join(" · ");

    return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        createdAt: booking.createdAt,
        startDate: booking.startDate,
        endDate: booking.endDate,
        duration: booking.duration,
        travellers: booking.travellers,
        tripTitle: booking.package?.title ?? booking.hotelBookings[0]?.hotel.name ?? booking.destination?.name ?? "Your trip",
        durationLabel: snap.duration_label ?? null,
        stayLabel: snap.stay_category_label ?? null,
        guestName: booking.user?.name ?? "Guest",
        guestContact: contact || null,
        isPackage: booking.packageId != null,
        days,
        inclusions: booking.package?.inclusions ?? [],
        exclusions: booking.package?.exclusions ?? [],
        policies,
        hotels: booking.hotelBookings,
        cabs: booking.cabBookings,
    };
}
