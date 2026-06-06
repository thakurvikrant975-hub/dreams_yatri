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

export interface FulfillmentItem {
    kind: ItemKind;
    day: number;
    key: string;
    title: string;
    subtitle: string | null;
    status: FulfillmentState;
    voucherUrl: string | null;
    paid: boolean; // activities: ticketed vs free; hotels/transfers: part of package
    driver?: { name: string | null; phone: string | null; vehicleNumber: string | null };
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
type SnapHotel = { hotel_id?: number; hotel_name?: string; hotel_city?: string | null; room_name?: string | null; plan_name?: string | null; num_nights?: number };
type SnapActivity = { id?: number; name?: string; variant_label?: string | null; is_optional?: boolean; total?: number };
type SnapTransfer = { pickup_name?: string | null; drop_name?: string | null; vehicle_name?: string | null };
type SnapDay = { day: number; day_title?: string; day_date?: string | null; hotel?: SnapHotel | null; activities?: SnapActivity[]; transfers?: SnapTransfer[] };
type Snapshot = { days?: SnapDay[] };

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

    // Fulfilment rows
    const [hotels, cabs, activities] = await Promise.all([
        db.bookingHotel.findMany({ where: { bookingId }, select: { dayNumber: true, hotelId: true, status: true, isConfirmed: true, voucherUrl: true } }),
        db.bookingCab.findMany({ where: { bookingId }, select: { transferDate: true, status: true, isConfirmed: true, voucherUrl: true, driverName: true, driverPhone: true, vehicleNumber: true } }),
        db.bookingActivity.findMany({ where: { bookingId }, select: { dayNumber: true, activityId: true, status: true, voucherUrl: true } }),
    ]);

    const hotelByDay = new Map(hotels.map((h) => [h.dayNumber, h]));
    const activityByKey = new Map(activities.map((a) => [`${a.dayNumber}:${a.activityId}`, a]));
    const cabByDate = new Map(cabs.map((c) => [c.transferDate.toISOString().slice(0, 10), c]));

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
            items.push({
                kind: "HOTEL", day: d.day, key: `hotel:${d.day}`,
                title: finalName,
                subtitle: [d.hotel.room_name, d.hotel.plan_name, d.hotel.hotel_city].filter(Boolean).join(" · ") || null,
                status, voucherUrl: row?.voucherUrl ?? null, paid: true,
            });
            total++; count(status);
        }

        // Transfers (served by the day's cab)
        for (const [i, t] of (d.transfers ?? []).entries()) {
            const row = cabByDate.get(dayISO);
            const status = resolve(row?.status, row?.isConfirmed ?? false, paid, cancelled);
            items.push({
                kind: "TRANSFER", day: d.day, key: `transfer:${d.day}:${i}`,
                title: `${t.pickup_name ?? "—"} → ${t.drop_name ?? "—"}`,
                subtitle: t.vehicle_name ?? null,
                status, voucherUrl: row?.voucherUrl ?? null, paid: true,
                driver: row ? { name: row.driverName, phone: row.driverPhone, vehicleNumber: row.vehicleNumber } : undefined,
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
                title: a.name ?? "Activity",
                subtitle: a.variant_label ?? null,
                status, voucherUrl: row?.voucherUrl ?? null, paid: isPaid,
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
