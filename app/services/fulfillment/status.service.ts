import "server-only";
import { db } from "@/app/lib/db";

/**
 * Fulfilment read-model (Status tracking, Phase 1.2).
 *
 * Derives the per-item fulfilment view for a booking by joining the immutable
 * PLAN (Booking.priceSnapshot) with the mutable FULFILMENT rows
 * (BookingHotel / BookingCab / BookingActivity). Items without a fulfilment row
 * yet default to IN_PROCESS once the booking is paid (else AWAITING_PAYMENT) —
 * so the customer sees "we're arranging it" immediately, and ops actions later
 * flip individual items to CONFIRMED / UNAVAILABLE, etc.
 *
 * Pure read — used by the customer status page (Phase 2) and admin (Phase 3).
 */

export type ItemKind = "HOTEL" | "TRANSFER" | "ACTIVITY";
export type FulfillmentState =
    | "AWAITING_PAYMENT"
    | "IN_PROCESS"
    | "CONFIRMED"
    | "UNAVAILABLE"
    | "REPLACED"
    | "CANCELLED";

export interface HotelPricing {
    roomType: string;
    roomsCount: number;
    ratePerRoom: number;
    roomTotal: number;
    mattressesCount: number;
    extraBedRate: number;
    mattressTotal: number;
    meals: { mealType: string; label: string; ratePerPerson: number; travellers: number; total: number }[];
    grandTotal: number;
}

export interface FulfillmentItem {
    kind: ItemKind;
    day: number;
    key: string;
    activityId?: number | null; // set for ACTIVITY items (target for admin writes)
    title: string;
    subtitle: string | null;
    status: FulfillmentState;
    voucherUrl: string | null;
    paid: boolean; // activities: ticketed vs free; hotels/transfers: part of package
    driver?: { name: string | null; phone: string | null; vehicleNumber: string | null };
    offer?: ReplacementOfferView | null; // ops-proposed alternatives (when UNAVAILABLE)
    hotelPricing?: HotelPricing | null;
    hotelChanged?: boolean;           // confirmed hotel differs from snapshot
    hotelPriceDiff?: number | null;   // rupees: confirmed room cost − snapshot room cost
    originalHotelName?: string | null; // snapshot hotel name (before the change)
    roomChanged?: boolean;            // same hotel, but room/plan differs from snapshot (upgrade/downgrade)
    originalRoomType?: string | null; // snapshot room/plan label (before the change)
    newRoomType?: string | null;      // confirmed room/plan label (after the change)
    cabChanged?: boolean;             // confirmed vehicle differs from the snapshot's planned vehicle
    cabPriceDiff?: number | null;     // rupees: confirmed day cost − snapshot day cost
    originalVehicleName?: string | null; // snapshot vehicle name (before the change)
}

export interface ReplacementOfferView {
    id: string;
    options: { id: string; label: string; sublabel: string | null }[];
}

export interface DayFulfillment {
    day: number;
    date: string | null;
    title: string;
    items: FulfillmentItem[];
}

export interface BookingFulfillment {
    bookingId: string;
    paid: boolean;
    cancelled: boolean;
    overall: "AWAITING_PAYMENT" | "IN_PROGRESS" | "READY" | "CANCELLED";
    summary: { total: number; confirmed: number; inProcess: number; attention: number };
    days: DayFulfillment[];
}

// ── Snapshot (plan) shape — display-safe subset ─────────────────────────────────
type SnapHotel = {
    hotel_id?: number; hotel_name?: string; hotel_city?: string | null;
    room_name?: string | null; plan_name?: string | null; num_nights?: number;
    rooms_count?: number; price_per_room?: number; total?: number;
    mattresses_count?: number; extra_bed_rate?: number;
};
type SnapMeal = { label?: string; meal_type?: string; price_per_person?: number; persons?: number; total?: number };
type SnapActivity = { id?: number; name?: string; variant_label?: string | null; is_optional?: boolean; total?: number };
type SnapTransfer = { pickup_name?: string | null; drop_name?: string | null; vehicle_name?: string | null };
type SnapDay = { day: number; day_title?: string; day_date?: string | null; hotel?: SnapHotel | null; meals?: SnapMeal[]; activities?: SnapActivity[]; transfers?: SnapTransfer[] };
type SnapCabSegment = { day_from: number; day_to: number; vehicle_name?: string | null; total?: number };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCabSegment[] };

const PAID_STATUSES = new Set(["ADVANCE_PAID", "FULLY_PAID"]);

function isoOfDay(start: Date, day: number): string {
    const d = new Date(start.getTime() + (day - 1) * 86_400_000);
    return d.toISOString().slice(0, 10);
}

/**
 * Resolve an item's display status: an explicit row status wins; else the legacy
 * `isConfirmed` flag (set by today's verify flows) counts as CONFIRMED; else
 * derive from payment (IN_PROCESS once paid, AWAITING_PAYMENT before).
 */
function resolve(rowStatus: string | null | undefined, isConfirmed: boolean, paid: boolean, cancelled: boolean): FulfillmentState {
    if (cancelled) return "CANCELLED";
    if (rowStatus && rowStatus !== "PENDING") return rowStatus as FulfillmentState;
    if (isConfirmed) return "CONFIRMED";
    return paid ? "IN_PROCESS" : "AWAITING_PAYMENT";
}

export async function getBookingFulfillment(bookingId: string): Promise<BookingFulfillment | null> {
    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, status: true, paymentStatus: true, startDate: true, priceSnapshot: true },
    });
    if (!booking) return null;

    const cancelled = booking.status === "CANCELLED";
    const paid = PAID_STATUSES.has(booking.paymentStatus);
    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
    const days = snapshot.days ?? [];

    // Fulfilment rows + open replacement offers
    const [hotels, cabs, activities, offers] = await Promise.all([
        db.bookingHotel.findMany({
            where: { bookingId },
            select: {
                dayNumber: true, hotelId: true, status: true, isConfirmed: true, voucherUrl: true,
                roomType: true, roomsCount: true, ratePerRoom: true, totalCost: true,
                meals: { select: { mealType: true, ratePerPerson: true, travellers: true, totalCost: true } },
            },
        }),
        db.bookingCab.findMany({ where: { bookingId }, select: { transferDate: true, status: true, isConfirmed: true, voucherUrl: true, driverName: true, driverPhone: true, vehicleNumber: true, vehicleName: true, totalCost: true } }),
        db.bookingActivity.findMany({ where: { bookingId }, select: { dayNumber: true, activityId: true, name: true, status: true, voucherUrl: true } }),
        db.replacementOffer.findMany({ where: { bookingId, status: "PROPOSED" }, select: { id: true, kind: true, day: true, activityId: true, options: true } }),
    ]);

    const hotelByDay = new Map(hotels.map((h) => [h.dayNumber, h]));
    const activityByKey = new Map(activities.map((a) => [`${a.dayNumber}:${a.activityId}`, a]));
    const cabByDate = new Map(cabs.map((c) => [c.transferDate.toISOString().slice(0, 10), c]));

    type RawOption = { id?: string; label?: string; sublabel?: string | null };
    const offerByKey = new Map<string, ReplacementOfferView>();
    for (const o of offers) {
        const key = o.kind === "ACTIVITY" ? `ACTIVITY:${o.day}:${o.activityId}` : `${o.kind}:${o.day}`;
        const opts = (Array.isArray(o.options) ? o.options : []) as RawOption[];
        offerByKey.set(key, { id: o.id, options: opts.map((x) => ({ id: x.id ?? "", label: x.label ?? "", sublabel: x.sublabel ?? null })) });
    }
    const offerFor = (key: string): ReplacementOfferView | null => offerByKey.get(key) ?? null;

    // Final hotel names for confirmed/replaced rows (the booked hotel may differ from the planned one)
    const rowHotelIds = [...new Set(hotels.map((h) => h.hotelId))];
    const hotelNames = rowHotelIds.length
        ? new Map((await db.hotels.findMany({ where: { id: { in: rowHotelIds } }, select: { id: true, name: true } })).map((h) => [h.id, h.name]))
        : new Map<number, string>();

    let confirmed = 0, inProcess = 0, attention = 0, total = 0;
    const count = (s: FulfillmentState) => {
        if (s === "CONFIRMED" || s === "REPLACED") confirmed++;
        else if (s === "IN_PROCESS" || s === "AWAITING_PAYMENT") inProcess++;
        else if (s === "UNAVAILABLE") attention++;
    };

    const outDays: DayFulfillment[] = days.map((d) => {
        const items: FulfillmentItem[] = [];
        const dayISO = d.day_date ?? isoOfDay(booking.startDate, d.day);

        // Hotel
        if (d.hotel) {
            const row = hotelByDay.get(d.day);
            const status = resolve(row?.status, row?.isConfirmed ?? false, paid, cancelled);
            const finalName = row ? (hotelNames.get(row.hotelId) ?? d.hotel.hotel_name ?? "Hotel") : (d.hotel.hotel_name ?? "Hotel");

            const hotelChanged = row != null && d.hotel.hotel_id != null ? row.hotelId !== d.hotel.hotel_id : false;
            const snapRoomTotal = Number(d.hotel.total ?? 0);
            const hotelPriceDiff = row != null ? Number(row.totalCost) - snapRoomTotal : null;
            const originalHotelName = hotelChanged ? (d.hotel.hotel_name ?? null) : null;

            // Room/plan upgraded or downgraded at the same hotel (e.g. Deluxe → Suite)
            const snapRoomLabel = [d.hotel.room_name, d.hotel.plan_name].filter(Boolean).join(" · ") || null;
            const roomChanged = row != null && !hotelChanged && snapRoomLabel != null && row.roomType !== snapRoomLabel;
            const originalRoomType = roomChanged ? snapRoomLabel : null;
            const newRoomType = roomChanged ? row!.roomType : null;

            // Build pricing from confirmed BookingHotel row or fall back to snapshot
            let hotelPricing: HotelPricing | null = null;
            if (row) {
                const roomTotal = Number(row.totalCost);
                const mealRows = row.meals.map((m) => ({
                    mealType: m.mealType,
                    label: m.mealType.charAt(0) + m.mealType.slice(1).toLowerCase().replace(/_/g, " "),
                    ratePerPerson: Number(m.ratePerPerson),
                    travellers: m.travellers,
                    total: Number(m.totalCost),
                }));
                const mealTotal = mealRows.reduce((s, m) => s + m.total, 0);
                hotelPricing = {
                    roomType: row.roomType,
                    roomsCount: row.roomsCount,
                    ratePerRoom: Number(row.ratePerRoom),
                    roomTotal,
                    mattressesCount: 0, extraBedRate: 0, mattressTotal: 0, // not stored in BookingHotel yet
                    meals: mealRows,
                    grandTotal: roomTotal + mealTotal,
                };
            } else if (d.hotel.rooms_count != null && d.hotel.price_per_room != null) {
                // Snapshot pricing (unconfirmed)
                const mattressesCount = d.hotel.mattresses_count ?? 0;
                const extraBedRate = d.hotel.extra_bed_rate ?? 0;
                const mattressTotal = mattressesCount * extraBedRate * (d.hotel.num_nights ?? 1);
                const roomTotal = Number(d.hotel.total ?? 0);
                const snapMeals = (d.meals ?? []).filter(m => m.price_per_person != null && (m.price_per_person ?? 0) > 0).map(m => ({
                    mealType: m.meal_type ?? "",
                    label: m.label ?? "",
                    ratePerPerson: Number(m.price_per_person ?? 0),
                    travellers: m.persons ?? 0,
                    total: Number(m.total ?? 0),
                }));
                const mealTotal = snapMeals.reduce((s, m) => s + m.total, 0);
                hotelPricing = {
                    roomType: [d.hotel.room_name, d.hotel.plan_name].filter(Boolean).join(" · ") || "Standard",
                    roomsCount: d.hotel.rooms_count,
                    ratePerRoom: Number(d.hotel.price_per_room),
                    roomTotal,
                    mattressesCount, extraBedRate, mattressTotal,
                    meals: snapMeals,
                    grandTotal: roomTotal + mattressTotal + mealTotal,
                };
            }

            items.push({
                kind: "HOTEL", day: d.day, key: `hotel:${d.day}`,
                title: finalName,
                subtitle: [d.hotel.room_name, d.hotel.plan_name, d.hotel.hotel_city].filter(Boolean).join(" · ") || null,
                status, voucherUrl: row?.voucherUrl ?? null, paid: true,
                offer: status === "UNAVAILABLE" ? offerFor(`HOTEL:${d.day}`) : null,
                hotelPricing,
                hotelChanged,
                hotelPriceDiff,
                originalHotelName,
                roomChanged,
                originalRoomType,
                newRoomType,
            });
            total++; count(status);
        }

        // Transfers (served by the day's cab)
        const cabSeg = (snapshot.cab_segments ?? []).find((s) => d.day >= s.day_from && d.day <= s.day_to);
        // `cabSeg.total` is the WHOLE segment's cost (can span several
        // consecutive days behind one vehicle) — prorate to this day's slice
        // before comparing against the confirmed row's (per-day) totalCost.
        const snapDayCost = cabSeg?.total ? cabSeg.total / Math.max(1, cabSeg.day_to - cabSeg.day_from + 1) : null;
        const originalVehicleName = cabSeg?.vehicle_name ?? d.transfers?.[0]?.vehicle_name ?? null;

        for (const [i, t] of (d.transfers ?? []).entries()) {
            const row = cabByDate.get(dayISO);
            const status = resolve(row?.status, row?.isConfirmed ?? false, paid, cancelled);
            const confirmedVehicleName = row?.vehicleName ?? null;
            const cabChanged = confirmedVehicleName != null && originalVehicleName != null && confirmedVehicleName !== originalVehicleName;
            const cabPriceDiff = row != null && snapDayCost != null ? Number(row.totalCost) - snapDayCost : null;
            items.push({
                kind: "TRANSFER", day: d.day, key: `transfer:${d.day}:${i}`,
                title: `${t.pickup_name ?? "—"} → ${t.drop_name ?? "—"}`,
                subtitle: confirmedVehicleName ?? t.vehicle_name ?? null,
                status, voucherUrl: row?.voucherUrl ?? null, paid: true,
                driver: row ? { name: row.driverName, phone: row.driverPhone, vehicleNumber: row.vehicleNumber } : undefined,
                offer: status === "UNAVAILABLE" ? offerFor(`TRANSFER:${d.day}`) : null,
                cabChanged,
                cabPriceDiff: cabChanged ? cabPriceDiff : null,
                originalVehicleName: cabChanged ? originalVehicleName : null,
            });
            total++; count(status);
        }

        // Activities — only the ones part of the package (exclude optional/unpaid)
        for (const a of d.activities ?? []) {
            if (a.is_optional) continue;
            const isPaid = (a.total ?? 0) > 0;
            const row = a.id != null ? activityByKey.get(`${d.day}:${a.id}`) : undefined;
            const status = resolve(row?.status, false, paid, cancelled);
            items.push({
                kind: "ACTIVITY", day: d.day, key: `activity:${d.day}:${a.id ?? a.name}`,
                activityId: a.id ?? null,
                title: row?.name ?? a.name ?? "Activity",
                subtitle: a.variant_label ?? null,
                status, voucherUrl: row?.voucherUrl ?? null, paid: isPaid,
                offer: status === "UNAVAILABLE" ? offerFor(`ACTIVITY:${d.day}:${a.id}`) : null,
            });
            total++; count(status);
        }

        return { day: d.day, date: dayISO, title: d.day_title ?? `Day ${d.day}`, items };
    });

    const overall: BookingFulfillment["overall"] =
        cancelled ? "CANCELLED"
        : !paid ? "AWAITING_PAYMENT"
        : total > 0 && confirmed >= total ? "READY"
        : "IN_PROGRESS";

    return {
        bookingId: booking.id,
        paid,
        cancelled,
        overall,
        summary: { total, confirmed, inProcess, attention },
        days: outDays,
    };
}
