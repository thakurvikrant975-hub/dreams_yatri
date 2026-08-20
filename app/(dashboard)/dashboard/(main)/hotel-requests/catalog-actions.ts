"use server";

// hotel-requests/catalog-actions.ts
//
// The writing half of the fill queue: turning what the hotel team learns on a
// phone call into catalog rows instead of a string on one package.
//
// A fill used to leave nothing behind (see fillPendingHotel in ./actions.ts) —
// the hotel's name went into custom_itineraries.accommodation and the rate into
// manualHotelPricePerNight, so the next exec searching that town found nothing
// and the same property got called again. Searching the catalog first fixed the
// half where the hotel already existed; these actions cover the half where it
// did not.
//
// What is deliberately NOT here: photos, amenities, policies, the full seasonal
// grid, every other room type on the rate sheet. The whole point is that this
// runs while somebody waits on the phone. One room and one rate, entered as real
// catalog data, is worth incomparably more than a complete record nobody has
// time to write — and the property can be finished later, off the clock.
//
// Access follows the page: /dashboard/hotel-requests is already restricted to
// the hotel team, so anyone who can open a request can create from it. Every row
// records who made it and which package it came from, so a bad entry traces back
// to the call it came from. A narrower create-specific permission is easy to add
// on top of that if it turns out to be wanted.

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { ensureHotelLocation } from "@/app/lib/hotel-location";
import { getCurrentMember } from "../lib/get-current-member";

type Actor = { id: string; name: string };

async function requireActor(): Promise<{ ok: true; actor: Actor } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, actor: { id: member.id, name: member.name } };
}

function slugify(s: string): string {
    return s.toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/** hotels.slug is unique, and two "Hotel Green View"s in different towns is the
 * normal case rather than the exception — so the town goes in the slug, and a
 * counter settles anything still colliding. */
async function uniqueHotelSlug(name: string, city: string): Promise<string> {
    const base = [slugify(name), slugify(city)].filter(Boolean).join("-") || "hotel";
    const taken = new Set(
        (await db.hotels.findMany({
            where: { slug: { startsWith: base } },
            select: { slug: true },
        })).map((h) => h.slug),
    );
    if (!taken.has(base)) return base;
    for (let i = 2; i < 500; i++) {
        if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
    }
    return `${base}-${Date.now()}`;
}

/**
 * Properties that look like the one about to be created.
 *
 * Shown before the create button, not after it. Quick-create under time pressure
 * is a duplicate factory, and this codebase has already paid for that once: the
 * destinations table had "Uttrakhand" and "uttarakhand" running side by side,
 * each with hundreds of hotels and packages hanging off it, before anyone
 * noticed. Doing the same to a catalog of nearly two thousand hotels would be a
 * considerably worse afternoon.
 *
 * Matching is loose on purpose — the failure that matters is missing an existing
 * property, not showing one candidate too many.
 */
export async function findSimilarHotels(name: string, city: string) {
    const n = name.trim();
    if (n.length < 3) return [];

    // Longest word in the name carries most of the signal: "Hotel Ganga Kinare"
    // and "Ganga Kinare Resort" should find each other, and "hotel" alone should
    // never match half the catalog.
    const longest = n.split(/\s+/).filter((w) => w.length > 3)
        .sort((a, b) => b.length - a.length)[0] ?? n;

    const rows = await db.hotels.findMany({
        where: {
            is_active: true,
            OR: [
                { name: { contains: n, mode: "insensitive" } },
                { name: { contains: longest, mode: "insensitive" } },
            ],
        },
        select: {
            id: true, name: true, city: true, state: true, stay_type: true,
            _count: { select: { room_pricing: true } },
        },
        take: 6,
    });

    const c = city.trim().toLowerCase();
    return rows
        // Same town first — a same-named property three states away is far less
        // likely to be the one on the phone.
        .sort((a, b) => Number((b.city ?? "").toLowerCase().includes(c)) - Number((a.city ?? "").toLowerCase().includes(c)))
        .map((h) => ({
            id: h.id,
            name: h.name,
            location: [h.city, h.state].filter(Boolean).join(", ") || null,
            starRating: h.stay_type,
            rateCount: h._count.room_pricing,
            sameCity: !!c && (h.city ?? "").toLowerCase().includes(c),
        }));
}

/** Provenance, written where it needs no migration to live. */
function provenanceNote(actor: Actor, packageId: string, day: number, validFrom?: string | null, validTo?: string | null) {
    const quoted = validFrom || validTo
        ? ` Quoted for ${validFrom || "?"} to ${validTo || "?"}.`
        : "";
    return `Added from a hotel request by ${actor.name} on ${new Date().toISOString().slice(0, 10)} `
        + `(package ${packageId}, day ${day}).${quoted}`;
}

/**
 * Writes the rate, and the room it hangs off, against a hotel already on file.
 *
 * An existing room is reused when the name matches, so filling three requests
 * for the same "Deluxe" does not leave three Deluxes behind.
 */
export async function addRateToHotel(input: {
    hotelId: number;
    roomName: string;
    pricePerNight: number;
    packageId: string;
    day: number;
    mealTypeId?: number | null;
    extraBedRate?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
}): Promise<{ success: boolean; roomPricingId?: number; error?: string }> {
    const auth = await requireActor();
    if (!auth.ok) return { success: false, error: auth.error };

    const roomName = input.roomName.trim() || "Standard Room";
    if (!(input.pricePerNight > 0)) return { success: false, error: "Enter a valid B2B price." };

    const hotel = await db.hotels.findFirst({
        where: { id: input.hotelId, is_active: true },
        select: { id: true, name: true },
    });
    if (!hotel) return { success: false, error: "That hotel is no longer on file." };

    const existingRoom = await db.hotel_rooms.findFirst({
        where: { hotel_id: hotel.id, name: { equals: roomName, mode: "insensitive" }, is_active: true },
        select: { id: true },
    });

    const roomId = existingRoom?.id ?? (await db.hotel_rooms.create({
        data: {
            hotel_id: hotel.id,
            name: roomName,
            slug: `${slugify(roomName)}-${hotel.id}`,
        },
        select: { id: true },
    })).id;

    const pricing = await db.hotel_room_pricing.create({
        data: {
            hotel_id: hotel.id,
            room_id: roomId,
            price_per_night: input.pricePerNight,
            meal_type_id: input.mealTypeId ?? null,
            extra_bed_rate: input.extraBedRate ?? null,
            // Recorded rather than enforced: season matching runs off
            // hotel_room_pricing_season, so this base rate stays applicable on
            // any date. The window is what the hotel actually quoted, kept so
            // the next person can see how old the number is.
            valid_from: input.validFrom ? new Date(input.validFrom) : null,
            valid_to: input.validTo ? new Date(input.validTo) : null,
            notes: provenanceNote(auth.actor, input.packageId, input.day, input.validFrom, input.validTo),
        },
        select: { id: true },
    });

    revalidatePath("/dashboard/hotels");
    return { success: true, roomPricingId: pricing.id };
}

/**
 * Creates a property, a room and a rate in one go, for a hotel that is not in
 * the catalog at all.
 *
 * It lands `is_active` and `listing_status: DRAFT`, which is exactly the pairing
 * that makes this safe to do in ninety seconds: the builder's hotel search
 * filters on is_active alone, so every sales exec can use it immediately, while
 * the public site gates on LIVE and never shows it. wizard_step stays at 0,
 * marking a property nothing has been completed on yet.
 */
export async function quickCreateHotelRate(input: {
    name: string;
    city: string;
    state?: string | null;
    stayType?: string | null;
    category?: string | null;
    /** Required. A hotel without coordinates never appears in the builder's
     * proximity search and shows no road distance — it exists without being
     * findable the way execs actually look for a stay. */
    latitude: number;
    longitude: number;
    roomName: string;
    pricePerNight: number;
    packageId: string;
    day: number;
    mealTypeId?: number | null;
    extraBedRate?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
}): Promise<{ success: boolean; roomPricingId?: number; hotelId?: number; error?: string }> {
    const auth = await requireActor();
    if (!auth.ok) return { success: false, error: auth.error };

    const name = input.name.trim();
    const city = input.city.trim();
    const roomName = input.roomName.trim() || "Standard Room";
    if (!name) return { success: false, error: "Hotel name is required." };
    if (!city) return { success: false, error: "Town is required — it's how the builder finds this hotel later." };
    if (!(input.pricePerNight > 0)) return { success: false, error: "Enter a valid B2B price." };
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
        return { success: false, error: "Pick the hotel's location so it can be found by distance later." };
    }

    const slug = await uniqueHotelSlug(name, city);

    const { hotelId, pricingId } = await db.$transaction(async (tx) => {
        const hotel = await tx.hotels.create({
            data: {
                name,
                slug,
                city,
                state: input.state?.trim() || null,
                stay_type: input.stayType?.trim() || null,
                category: input.category?.trim() || null,
                latitude: input.latitude,
                longitude: input.longitude,
                is_active: true,
                listing_status: "DRAFT",
                created_by: auth.actor.id,
                updated_by: auth.actor.id,
            },
            select: { id: true },
        });

        const room = await tx.hotel_rooms.create({
            data: { hotel_id: hotel.id, name: roomName, slug: `${slugify(roomName)}-${hotel.id}` },
            select: { id: true },
        });

        const pricing = await tx.hotel_room_pricing.create({
            data: {
                hotel_id: hotel.id,
                room_id: room.id,
                price_per_night: input.pricePerNight,
                meal_type_id: input.mealTypeId ?? null,
                extra_bed_rate: input.extraBedRate ?? null,
                valid_from: input.validFrom ? new Date(input.validFrom) : null,
                valid_to: input.validTo ? new Date(input.validTo) : null,
                notes: provenanceNote(auth.actor, input.packageId, input.day, input.validFrom, input.validTo),
            },
            select: { id: true },
        });

        return { hotelId: hotel.id, pricingId: pricing.id };
    });

    // Outside the transaction: this reads the hotel back and writes the HOTEL-type
    // Location row the proximity search joins against. Failing here leaves a
    // perfectly usable hotel that simply isn't searchable by distance yet, which
    // is not worth losing the rate over — the completion queue can repair it.
    try {
        await ensureHotelLocation(hotelId);
    } catch {
        // Intentionally swallowed; see above.
    }

    revalidatePath("/dashboard/hotels");
    return { success: true, roomPricingId: pricingId, hotelId };
}
