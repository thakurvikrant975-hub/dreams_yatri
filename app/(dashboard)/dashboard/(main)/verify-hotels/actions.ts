"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";
import { getThumbnailImage } from "@/app/lib/imageUrl";

export type RoomOption = {
    id: number;
    name: string;
    bed_type: string | null;
    view_type: string | null;
    max_occupancy: number;
    area_sqft: number | null;
    image_url: string | null;
    image_thumbnail: string | null;
    pricing: { id: number; plan_name: string | null; price_per_night: number; season_name: string | null }[];
};

export async function getRoomsForHotel(hotelId: number, checkInDate?: string): Promise<RoomOption[]> {
    const targetDate = checkInDate ? new Date(`${checkInDate}T00:00:00`) : null;

    const rows = await db.hotel_rooms.findMany({
        where: { hotel_id: hotelId, is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
            id: true, name: true, bed_type: true, view_type: true, max_occupancy: true, area_sqft: true,
            images: {
                orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                select: { url: true, thumbnail: true },
                take: 1,
            },
            pricing: {
                orderBy: { price_per_night: "asc" },
                select: {
                    id: true, plan_name: true, price_per_night: true,
                    seasons: {
                        where: { is_active: true },
                        select: { season_name: true, valid_from: true, valid_to: true, price_per_night: true },
                    },
                },
            },
        },
    });

    return rows.map((r) => ({
        id: r.id, name: r.name, bed_type: r.bed_type, view_type: r.view_type,
        max_occupancy: r.max_occupancy, area_sqft: r.area_sqft,
        image_url: r.images[0]?.url ? getThumbnailImage(r.images[0].url) : null,
        image_thumbnail: r.images[0]?.thumbnail ? getThumbnailImage(r.images[0].thumbnail) : null,
        pricing: r.pricing.map((p) => {
            let effectivePrice = Number(p.price_per_night);
            let seasonName: string | null = null;
            if (targetDate) {
                const season = p.seasons.find(
                    (s) => targetDate >= new Date(s.valid_from) && targetDate <= new Date(s.valid_to),
                );
                if (season) {
                    effectivePrice = Number(season.price_per_night);
                    seasonName = season.season_name;
                }
            }
            return { id: p.id, plan_name: p.plan_name, price_per_night: effectivePrice, season_name: seasonName };
        }),
    }));
}

export async function getRoomsForHotels(hotelIds: number[], checkInDate?: string): Promise<(RoomOption & { hotel_id: number })[]> {
    if (hotelIds.length === 0) return [];
    const targetDate = checkInDate ? new Date(`${checkInDate}T00:00:00`) : null;

    const rows = await db.hotel_rooms.findMany({
        where: { hotel_id: { in: hotelIds }, is_active: true },
        orderBy: [{ hotel_id: "asc" }, { sort_order: "asc" }],
        select: {
            id: true, hotel_id: true, name: true, bed_type: true, view_type: true,
            max_occupancy: true, area_sqft: true,
            images: {
                orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                select: { url: true, thumbnail: true },
                take: 1,
            },
            pricing: {
                orderBy: { price_per_night: "asc" },
                select: {
                    id: true, plan_name: true, price_per_night: true,
                    seasons: {
                        where: { is_active: true },
                        select: { season_name: true, valid_from: true, valid_to: true, price_per_night: true },
                    },
                },
            },
        },
    });

    return rows.map((r) => ({
        hotel_id: r.hotel_id,
        id: r.id, name: r.name, bed_type: r.bed_type, view_type: r.view_type,
        max_occupancy: r.max_occupancy, area_sqft: r.area_sqft,
        image_url: r.images[0]?.url ? getThumbnailImage(r.images[0].url) : null,
        image_thumbnail: r.images[0]?.thumbnail ? getThumbnailImage(r.images[0].thumbnail) : null,
        pricing: r.pricing.map((p) => {
            let effectivePrice = Number(p.price_per_night);
            let seasonName: string | null = null;
            if (targetDate) {
                const season = p.seasons.find(
                    (s) => targetDate >= new Date(s.valid_from) && targetDate <= new Date(s.valid_to),
                );
                if (season) {
                    effectivePrice = Number(season.price_per_night);
                    seasonName = season.season_name;
                }
            }
            return { id: p.id, plan_name: p.plan_name, price_per_night: effectivePrice, season_name: seasonName };
        }),
    }));
}

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

type SnapHotel = { hotel_id: number; rooms_count: number; num_nights: number };
type SnapDay = { day: number; hotel: SnapHotel | null };
type Snapshot = { days?: SnapDay[] };

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
        select: { status: true, priceSnapshot: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

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
            totalCost,
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
            totalCost,
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            notes: notes?.trim() || null,
        },
    });

    // Count total hotel days in snapshot
    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
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

    revalidatePath(`/dashboard/verify-hotels/${bookingId}`);
    revalidatePath("/dashboard/verify-hotels");
    return { success: true, allConfirmed };
}
