"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";
import { getThumbnailImage } from "@/app/lib/imageUrl";
import { notifyOwnerBookingConfirmed } from "@/app/services/notifications/owner-notify";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";

export type MealOption = { meal_type: string; label: string; price_per_person: number };

export type RoomOption = {
    id: number;
    name: string;
    bed_type: string | null;
    view_type: string | null;
    max_occupancy: number;       // beds only (standard capacity)
    extra_bed_capacity: number;  // additional mattress slots
    area_sqft: number | null;
    image_url: string | null;
    image_thumbnail: string | null;
    pricing: {
        id: number;
        plan_name: string | null;
        price_per_night: number;
        season_name: string | null;
        extra_bed_rate: number | null;
    }[];
};

export async function getRoomsForHotel(hotelId: number, checkInDate?: string): Promise<RoomOption[]> {
    const targetDate = checkInDate ? new Date(`${checkInDate}T00:00:00`) : null;

    const rows = await db.hotel_rooms.findMany({
        where: { hotel_id: hotelId, is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
            id: true, name: true, bed_type: true, view_type: true, max_occupancy: true, extra_bed_capacity: true, area_sqft: true,
            images: {
                orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                select: { url: true, thumbnail: true },
                take: 1,
            },
            pricing: {
                orderBy: { price_per_night: "asc" },
                select: {
                    id: true, plan_name: true, price_per_night: true, extra_bed_rate: true,
                    seasons: {
                        where: { is_active: true },
                        select: { season_name: true, valid_from: true, valid_to: true, price_per_night: true, extra_bed_rate: true },
                    },
                },
            },
        },
    });

    return rows.map((r) => ({
        id: r.id, name: r.name, bed_type: r.bed_type, view_type: r.view_type,
        max_occupancy: r.max_occupancy, extra_bed_capacity: r.extra_bed_capacity, area_sqft: r.area_sqft,
        image_url: r.images[0]?.url ? getThumbnailImage(r.images[0].url) : null,
        image_thumbnail: r.images[0]?.thumbnail ? getThumbnailImage(r.images[0].thumbnail) : null,
        pricing: r.pricing.map((p) => {
            let effectivePrice = Number(p.price_per_night);
            let seasonName: string | null = null;
            let extraBedRate: number | null = p.extra_bed_rate != null ? Number(p.extra_bed_rate) : null;
            if (targetDate) {
                const season = p.seasons.find(
                    (s) => targetDate >= new Date(s.valid_from) && targetDate <= new Date(s.valid_to),
                );
                if (season) {
                    effectivePrice = Number(season.price_per_night);
                    seasonName = season.season_name;
                    if (season.extra_bed_rate != null) extraBedRate = Number(season.extra_bed_rate);
                }
            }
            return { id: p.id, plan_name: p.plan_name, price_per_night: effectivePrice, season_name: seasonName, extra_bed_rate: extraBedRate };
        }),
    }));
}

// Fetch real road distances from OSRM (OpenStreetMap routing)
export async function getRoadDistances(
    originLat: number,
    originLon: number,
    hotels: { id: number; lat: number; lon: number }[],
): Promise<{ id: number; distanceKm: number }[]> {
    if (hotels.length === 0) return [];
    const limited = hotels.slice(0, 100); // OSRM URL length safety
    const coords = [
        `${originLon},${originLat}`,
        ...limited.map((h) => `${h.lon},${h.lat}`),
    ].join(";");
    try {
        const res = await fetch(
            `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance`,
            { next: { revalidate: 86400 } }, // cache 24 h — road distances rarely change
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (data.code !== "Ok" || !Array.isArray(data.distances?.[0])) return [];
        const row: (number | null)[] = data.distances[0];
        return limited
            .map((h, i) => ({ id: h.id, distanceKm: (row[i + 1] ?? -1) / 1000 }))
            .filter((d) => d.distanceKm >= 0);
    } catch {
        return [];
    }
}

export async function getRoomsForHotels(hotelIds: number[], checkInDate?: string): Promise<(RoomOption & { hotel_id: number })[]> {
    if (hotelIds.length === 0) return [];
    const targetDate = checkInDate ? new Date(`${checkInDate}T00:00:00`) : null;

    const rows = await db.hotel_rooms.findMany({
        where: { hotel_id: { in: hotelIds }, is_active: true },
        orderBy: [{ hotel_id: "asc" }, { sort_order: "asc" }],
        select: {
            id: true, hotel_id: true, name: true, bed_type: true, view_type: true,
            max_occupancy: true, extra_bed_capacity: true, area_sqft: true,
            images: {
                orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                select: { url: true, thumbnail: true },
                take: 1,
            },
            pricing: {
                orderBy: { price_per_night: "asc" },
                select: {
                    id: true, plan_name: true, price_per_night: true, extra_bed_rate: true,
                    seasons: {
                        where: { is_active: true },
                        select: { season_name: true, valid_from: true, valid_to: true, price_per_night: true, extra_bed_rate: true },
                    },
                },
            },
        },
    });

    return rows.map((r) => ({
        hotel_id: r.hotel_id,
        id: r.id, name: r.name, bed_type: r.bed_type, view_type: r.view_type,
        max_occupancy: r.max_occupancy, extra_bed_capacity: r.extra_bed_capacity, area_sqft: r.area_sqft,
        image_url: r.images[0]?.url ? getThumbnailImage(r.images[0].url) : null,
        image_thumbnail: r.images[0]?.thumbnail ? getThumbnailImage(r.images[0].thumbnail) : null,
        pricing: r.pricing.map((p) => {
            let effectivePrice = Number(p.price_per_night);
            let seasonName: string | null = null;
            let extraBedRate: number | null = p.extra_bed_rate != null ? Number(p.extra_bed_rate) : null;
            if (targetDate) {
                const season = p.seasons.find(
                    (s) => targetDate >= new Date(s.valid_from) && targetDate <= new Date(s.valid_to),
                );
                if (season) {
                    effectivePrice = Number(season.price_per_night);
                    seasonName = season.season_name;
                    if (season.extra_bed_rate != null) extraBedRate = Number(season.extra_bed_rate);
                }
            }
            return { id: p.id, plan_name: p.plan_name, price_per_night: effectivePrice, season_name: seasonName, extra_bed_rate: extraBedRate };
        }),
    }));
}

export async function getMealsForHotels(
    hotelIds: number[],
    mealTypes: string[], // only fetch these meal types (derived from snapshot)
    checkInDate?: string,
): Promise<{ hotel_id: number; meals: MealOption[] }[]> {
    if (hotelIds.length === 0 || mealTypes.length === 0) return [];
    const targetDate = checkInDate ? new Date(`${checkInDate}T00:00:00`) : null;

    const rows = await db.hotel_meal_pricing.findMany({
        where: { hotel_id: { in: hotelIds }, is_active: true, meal_type: { in: mealTypes } },
        orderBy: [{ hotel_id: "asc" }, { sort_order: "asc" }],
        select: {
            hotel_id: true, meal_type: true, label: true, price: true,
            seasons: {
                where: { is_active: true },
                select: { valid_from: true, valid_to: true, price: true },
            },
        },
    });

    const byHotel = new Map<number, { meal_type: string; label: string; price_per_person: number }[]>();
    for (const r of rows) {
        let price = Number(r.price);
        if (targetDate) {
            const season = r.seasons.find(
                (s) => targetDate >= new Date(s.valid_from) && targetDate <= new Date(s.valid_to),
            );
            if (season) price = Number(season.price);
        }
        if (!byHotel.has(r.hotel_id)) byHotel.set(r.hotel_id, []);
        byHotel.get(r.hotel_id)!.push({ meal_type: r.meal_type, label: r.label, price_per_person: price });
    }

    return Array.from(byHotel.entries()).map(([hotel_id, meals]) => ({ hotel_id, meals }));
}

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

type SnapHotel = { hotel_id?: number; rooms_count?: number; num_nights?: number; total?: number };
type SnapDay = { day: number; hotel: SnapHotel | null };
type Snapshot = { days?: SnapDay[] };

const inrFmt = (r: number) => `₹${Math.abs(Math.round(r)).toLocaleString("en-IN")}`;

export async function confirmHotelStay(
    bookingId: string,
    dayNumber: number,
    hotelId: number,
    {
        cityName,
        checkInDate,
        checkOutDate,
        roomType,
        roomsCount,
        ratePerRoom,
        totalCost,
        notes,
    }: {
        cityName: string;
        checkInDate: string;
        checkOutDate: string;
        roomType: string;
        roomsCount: number;
        ratePerRoom: number;
        totalCost: number;
        notes?: string;
    },
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const hotel = await db.hotels.findUnique({ where: { id: hotelId }, select: { id: true, name: true } });
    if (!hotel) return { success: false, error: "Selected hotel not found." };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { bookingNumber: true, status: true, priceSnapshot: true, totalAmount_paise: true, balanceAmount_paise: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    // Read existing BookingHotel row (before upsert) to compute price delta
    const existingRow = await db.bookingHotel.findUnique({
        where: { bookingId_dayNumber: { bookingId, dayNumber } },
        select: { totalCost: true, hotelId: true, isConfirmed: true },
    });

    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
    const snapDay = (snapshot.days ?? []).find((d) => d.day === dayNumber);
    const snapHotelTotal = snapDay?.hotel?.total != null ? Number(snapDay.hotel.total) : null;
    const snapHotelId = snapDay?.hotel?.hotel_id ?? null;

    // Baseline cost: previous confirmed row, or snapshot total if first confirmation.
    // Round both sides UP to a whole rupee first so the delta (and therefore the
    // updated totalAmount_paise/balanceAmount_paise) can never land on a fractional rupee.
    const baselineCost = existingRow != null ? Number(existingRow.totalCost) : (snapHotelTotal ?? totalCost);
    const totalCostRounded = Math.ceil(totalCost);
    const baselineCostRounded = Math.ceil(baselineCost);
    const priceDeltaRupees = totalCostRounded - baselineCostRounded;
    const deltaPaise = priceDeltaRupees * 100;
    const hotelActuallyChanged = existingRow != null
        ? existingRow.hotelId !== hotelId
        : (snapHotelId != null && snapHotelId !== hotelId);

    // Upsert the BookingHotel record
    await db.bookingHotel.upsert({
        where: { bookingId_dayNumber: { bookingId, dayNumber } },
        create: {
            bookingId,
            dayNumber,
            cityName,
            checkInDate: new Date(checkInDate),
            checkOutDate: new Date(checkOutDate),
            hotelId,
            roomType,
            roomsCount,
            ratePerRoom,
            totalCost: totalCostRounded,
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            notes: notes?.trim() || null,
        },
        update: {
            hotelId,
            roomType,
            roomsCount,
            ratePerRoom,
            totalCost: totalCostRounded,
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            notes: notes?.trim() || null,
        },
    });

    // Owner notification (best-effort) — only on a genuinely new confirmation
    // or when the confirmed hotel actually changed, not on every edit to an
    // already-confirmed row (price tweak, notes, etc.).
    if (!existingRow?.isConfirmed || hotelActuallyChanged) {
        try {
            await notifyOwnerBookingConfirmed({
                hotelId,
                bookingNumber: booking.bookingNumber,
                checkInDate: new Date(checkInDate),
                checkOutDate: new Date(checkOutDate),
                roomType,
                roomsCount,
            });
        } catch (e) {
            console.error("[confirmHotelStay] owner notify", e);
        }
    }

    // Update booking totals when room cost changed
    if (Math.abs(deltaPaise) >= 1) {
        await db.booking.update({
            where: { id: bookingId },
            data: {
                totalAmount_paise: booking.totalAmount_paise + deltaPaise,
                balanceAmount_paise: Math.max(0, booking.balanceAmount_paise + deltaPaise),
            },
        });
    }

    // Count total hotel days in snapshot
    const totalHotelDays = (snapshot.days ?? []).filter((d) => d.hotel !== null).length;

    // Count confirmed BookingHotel records for this booking
    const confirmedCount = await db.bookingHotel.count({
        where: { bookingId, isConfirmed: true },
    });

    const allConfirmed = confirmedCount >= totalHotelDays && totalHotelDays > 0;

    if (allConfirmed && booking.status === "PENDING_REVIEW" || allConfirmed && booking.status === "HOTEL_VERIFICATION") {
        await db.$transaction([
            db.booking.update({
                where: { id: bookingId },
                data: {
                    status: "HOTEL_CONFIRMED",
                    hotelConfirmedAt: new Date(),
                    hotelAgentName: gate.member.name,
                },
            }),
            db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: "DEPARTMENT_CONFIRMED",
                    fromStatus: booking.status as "PENDING_REVIEW" | "HOTEL_VERIFICATION",
                    toStatus: "HOTEL_CONFIRMED",
                    note: `All ${totalHotelDays} hotel stay${totalHotelDays !== 1 ? "s" : ""} confirmed by ${gate.member.name}. Booking moved to Hotel Confirmed.`,
                    performedById: gate.member.id,
                    performedByName: gate.member.name,
                    departmentId: gate.member.department?.id ?? null,
                },
            }),
        ]);
        // Booking leaves the hotel queue and — since it's no longer excluded
        // by verify-cabs' status filter — may newly enter the cab queue too.
        await broadcastVerificationCounts();
    } else {
        await db.bookingTimeline.create({
            data: {
                bookingId,
                action: "NOTE_ADDED",
                note: `Day ${dayNumber} (${cityName}) hotel confirmed as "${hotel.name}" by ${gate.member.name}.${notes?.trim() ? ` Notes: ${notes.trim()}` : ""}`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

    // Price change log — written whenever hotel changes or cost differs from baseline
    if (hotelActuallyChanged || Math.abs(deltaPaise) >= 100) {
        const diffStr = priceDeltaRupees > 0 ? `+${inrFmt(priceDeltaRupees)}` : `-${inrFmt(priceDeltaRupees)}`;
        const changeLabel = hotelActuallyChanged ? `Hotel changed to "${hotel.name}"` : `Hotel re-confirmed as "${hotel.name}"`;
        const priceLabel = Math.abs(deltaPaise) >= 100
            ? `. Room cost ${priceDeltaRupees > 0 ? "increased" : "decreased"} by ${inrFmt(priceDeltaRupees)} (${diffStr} vs baseline).`
            : " (no room cost change).";
        await db.bookingTimeline.create({
            data: {
                bookingId,
                action: "NOTE_ADDED",
                note: `[PRICE CHANGE] Day ${dayNumber}: ${changeLabel}${priceLabel}`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

    revalidatePath(`/dashboard/verify-hotels/${bookingId}`);
    revalidatePath("/dashboard/verify-hotels");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath(`/bookings/${bookingId}/status`);
    return { success: true, allConfirmed };
}
