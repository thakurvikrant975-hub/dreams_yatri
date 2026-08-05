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
type SnapTransfer = { pickup_name: string | null; drop_name: string | null; vehicle_name: string | null };
type SnapDay = {
    day: number;
    day_title: string;
    day_date: string | null;
    hotel: SnapHotel | null;
    meals: { label: string }[];
    activities: { id: number; name: string; is_optional: boolean }[];
    transfers?: SnapTransfer[];
};
type SnapCabSegment = { day_from: number; day_to: number; vehicle_name: string | null; vehicle_capacity?: number };
type Snapshot = {
    duration_label?: string;
    stay_category_label?: string;
    days?: SnapDay[];
    cab_segments?: SnapCabSegment[];
};

/** Fulfilment state of one booked item. `null` where ops hasn't created the row
 *  yet, which the voucher shows as Pending — nothing is confirmed by default. */
export type VoucherStatus = { isConfirmed: boolean; status: string };

export type VoucherDay = {
    day: number;
    title: string;
    date: Date | null;
    hotelName: string | null;
    /** 1–5 when the hotel row carries a rating, else null — drives the stars. */
    hotelStars: number | null;
    roomLabel: string | null;
    hotelStatus: VoucherStatus | null;
    meals: string[];
    /** The booked rate's plan name ("… with Breakfast & Dinner"). Priced meals
     *  live in `meals`, but a plan whose meals are bundled into the room rate
     *  produces no meal lines at all — the plan name is then the only record of
     *  what the guest is fed, so the table falls back to it. */
    mealPlan: string | null;
    /** Meals the stay includes, as a phrase for the hotel cell ("Breakfast
     *  included"). Empty when the rate is room-only. */
    mealsIncluded: string[];
    activities: VoucherActivity[];
};

export type VoucherActivity = VoucherStatus & { name: string; isOptional: boolean };

export type VoucherPolicy = { title: string; points: string[] };

const MEAL_WORDS = ["Breakfast", "Lunch", "Dinner"] as const;

/**
 * What the stay feeds the guest, for the hotel cell.
 *
 * Priced meal lines are the reliable source, but a rate whose meals are bundled
 * into the room price produces none — there the plan name is all we have. Indian
 * rate plans spell it either in words ("… with Breakfast & Dinner") or in the
 * trade's codes, so both are read: EP room-only, CP breakfast, MAP breakfast and
 * dinner, AP all three.
 */
function mealsFromPlan(meals: string[], planName: string | null): string[] {
    if (meals.length > 0) return meals;
    if (!planName) return [];

    const named = MEAL_WORDS.filter((m) => new RegExp(`\\b${m}`, "i").test(planName));
    if (named.length > 0) return [...named];

    const code = planName.match(/\b(EP|CP|MAP|AP)\b/i)?.[1]?.toUpperCase();
    if (code === "CP") return ["Breakfast"];
    if (code === "MAP") return ["Breakfast", "Dinner"];
    if (code === "AP") return ["Breakfast", "Lunch", "Dinner"];
    return [];
}

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
    cabs: VoucherCab[];
};

export type VoucherCab = {
    legNumber: number;
    fromLocation: string;
    toLocation: string;
    transferDate: Date;
    cabType: string;
    cabCount: number;
    /** 0 when the snapshot didn't record a seat count — the voucher then omits
     *  the "(n-seater)" note rather than printing "(0-seater)". */
    capacity: number;
    isConfirmed: boolean;
    status: string;
    driverName: string | null;
    driverPhone: string | null;
    vehicleNumber: string | null;
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
            bookingActivities: {
                select: { dayNumber: true, activityId: true, status: true },
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

    // Fulfilment lives on the ops rows, which are keyed by day (and by activity
    // within a day). Anything ops hasn't created yet has no row at all, which is
    // reported as Pending rather than left blank — an unconfirmed stay a guest
    // can't distinguish from a confirmed one is the failure worth avoiding.
    const hotelStatusByDay = new Map(
        booking.hotelBookings.map((h) => [h.dayNumber, { isConfirmed: h.isConfirmed, status: h.status }]),
    );
    const activityStatusByKey = new Map(
        booking.bookingActivities.map((a) => [`${a.dayNumber}:${a.activityId}`, a.status]),
    );

    const days: VoucherDay[] = snapDays.map((d) => {
        const stars = d.hotel ? starsById.get(d.hotel.hotel_id) ?? null : null;
        const meals = (d.meals ?? []).map((m) => m.label).filter(Boolean);
        return {
            day: d.day,
            title: d.day_title,
            date: d.day_date ? new Date(d.day_date) : null,
            hotelName: d.hotel?.hotel_name ?? null,
            hotelStars: stars && stars >= 1 && stars <= 5 ? stars : null,
            roomLabel: d.hotel?.room_name ?? null,
            hotelStatus: d.hotel
                ? hotelStatusByDay.get(d.day) ?? { isConfirmed: false, status: "PENDING" }
                : null,
            meals,
            mealPlan: d.hotel?.plan_name ?? null,
            mealsIncluded: d.hotel ? mealsFromPlan(meals, d.hotel.plan_name) : [],
            activities: (d.activities ?? []).map((a) => {
                const status = activityStatusByKey.get(`${d.day}:${a.id}`) ?? "PENDING";
                return { name: a.name, isOptional: a.is_optional, isConfirmed: status === "CONFIRMED", status };
            }),
        };
    });

    // A BookingCab row only exists once ops assigns a driver (see
    // dashboard/assign-driver/actions.ts), so a freshly paid booking has none and
    // the transport table would read "no cab assigned" for a trip that was sold
    // with one. The snapshot's transfer days are the plan the guest paid for, so
    // they drive the rows, with any assigned leg overlaid on top — same
    // reconciliation the assign-driver screen does.
    const cabByLeg = new Map(booking.cabBookings.map((c) => [c.legNumber, c]));
    const transferDays = snapDays.filter((d) => (d.transfers ?? []).length > 0);
    const startMs = booking.startDate.getTime();

    const cabs: VoucherCab[] = transferDays.length > 0
        ? transferDays.map((d) => {
            const assigned = cabByLeg.get(d.day);
            const transfers = d.transfers ?? [];
            const segment = (snap.cab_segments ?? []).find((c) => d.day >= c.day_from && d.day <= c.day_to);
            return {
                legNumber: d.day,
                fromLocation: assigned?.fromLocation ?? transfers[0]?.pickup_name ?? "—",
                toLocation: assigned?.toLocation ?? transfers[transfers.length - 1]?.drop_name ?? "—",
                transferDate: assigned?.transferDate
                    ?? (d.day_date ? new Date(`${d.day_date}T00:00:00`) : new Date(startMs + (d.day - 1) * 86_400_000)),
                cabType: assigned?.cabType ?? segment?.vehicle_name ?? transfers[0]?.vehicle_name ?? "Cab",
                cabCount: assigned?.cabCount ?? 1,
                capacity: assigned?.capacity ?? segment?.vehicle_capacity ?? 0,
                isConfirmed: assigned?.isConfirmed ?? false,
                status: assigned?.status ?? "PENDING",
                driverName: assigned?.driverName ?? null,
                driverPhone: assigned?.driverPhone ?? null,
                vehicleNumber: assigned?.vehicleNumber ?? null,
            };
        })
        // No transfers in the snapshot (a hotel-only booking, or a package sold
        // without transport) — whatever ops assigned is then the whole story.
        : booking.cabBookings;

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
        cabs,
    };
}
