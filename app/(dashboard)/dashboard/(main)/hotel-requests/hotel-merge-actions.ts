"use server";

// hotel-requests/hotel-merge-actions.ts
//
// Folding one hotel record into another, for the duplicates that quick-create
// inevitably produces.
//
// Built alongside the create path rather than after the mess, because this
// codebase has already paid for the other order once: the destinations table ran
// "Uttrakhand" and "uttarakhand" side by side until each had hundreds of hotels
// and packages hanging off it. A catalog of nearly two thousand hotels is a
// worse version of that afternoon.
//
// The strategy is to MOVE rows, never to delete or fold them together. Every
// child row keeps its own id and simply changes which hotel it belongs to, and
// only the emptied hotels row is deleted at the end. That matters more than it
// looks: custom_itineraries.roomPricingId and custom_itinerary_stays.roomPricingId
// point at hotel_room_pricing WITHOUT a foreign key to enforce it, so a merge
// that deleted or rewrote rate rows would leave already-sold packages pointing at
// rates that no longer exist, and nothing in the database would complain. Moving
// rows keeps every one of those references valid without having to find them.
//
// Referencing tables are discovered from pg_constraint at run time rather than
// hardcoded, so a table added later is still caught.

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";

type FkRef = { tbl: string; col: string };

async function referencingColumns(): Promise<FkRef[]> {
    return db.$queryRaw<FkRef[]>`
        SELECT src.relname AS tbl, att.attname AS col
        FROM pg_constraint con
        JOIN pg_class src ON src.oid = con.conrelid
        JOIN pg_class tgt ON tgt.oid = con.confrelid
        JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
        JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = k.attnum
        WHERE con.contype = 'f' AND tgt.relname = 'hotels'
        ORDER BY src.relname, att.attname`;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

export type MergePreview = {
    ok: boolean;
    error?: string;
    winner?: { id: number; name: string; location: string | null; rates: number; rooms: number };
    loser?: { id: number; name: string; location: string | null; rates: number; rooms: number };
    /** What would move, per table. */
    moves?: { table: string; column: string; rows: number }[];
    /** Room slugs that clash on the winner and would be suffixed to fit. */
    slugClashes?: string[];
    totalRows?: number;
};

/** What a merge would touch, resolved before anyone commits to it. */
export async function previewHotelMerge(winnerId: number, loserId: number): Promise<MergePreview> {
    const member = await getCurrentMember();
    if (!member?.isActive) return { ok: false, error: "Not authorised." };
    if (winnerId === loserId) return { ok: false, error: "Pick two different hotels." };

    const [winner, loser] = await Promise.all([winnerId, loserId].map((id) =>
        db.hotels.findUnique({
            where: { id },
            select: {
                id: true, name: true, city: true, state: true,
                _count: { select: { room_pricing: true, hotelRooms: true } },
            },
        })));
    if (!winner || !loser) return { ok: false, error: "One of those hotels no longer exists." };

    const shape = (h: NonNullable<typeof winner>) => ({
        id: h.id,
        name: h.name,
        location: [h.city, h.state].filter(Boolean).join(", ") || null,
        rates: h._count.room_pricing,
        rooms: h._count.hotelRooms,
    });

    const moves: { table: string; column: string; rows: number }[] = [];
    for (const fk of await referencingColumns()) {
        const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT COUNT(*)::bigint AS n FROM ${ident(fk.tbl)} WHERE ${ident(fk.col)} = $1`, loserId);
        if (Number(n) > 0) moves.push({ table: fk.tbl, column: fk.col, rows: Number(n) });
    }

    // hotel_rooms is unique on (hotel_id, slug), so two properties each with a
    // "deluxe-room" collide the moment they share a hotel_id.
    const clashes = await db.$queryRaw<{ slug: string }[]>`
        SELECT l.slug FROM hotel_rooms l
        WHERE l.hotel_id = ${loserId}
          AND EXISTS (SELECT 1 FROM hotel_rooms w WHERE w.hotel_id = ${winnerId} AND w.slug = l.slug)`;

    return {
        ok: true,
        winner: shape(winner),
        loser: shape(loser),
        moves,
        slugClashes: clashes.map((c) => c.slug),
        totalRows: moves.reduce((sum, m) => sum + m.rows, 0),
    };
}

/**
 * Moves everything off `loserId` onto `winnerId` and deletes the emptied record.
 *
 * The delete only runs after a fresh count proves nothing points at the loser any
 * more — the same discipline the destinations merge used, and for the same
 * reason: it is the one irreversible step in the whole operation.
 */
export async function mergeHotels(
    winnerId: number,
    loserId: number,
): Promise<{ success: boolean; error?: string; movedRows?: number }> {
    const member = await getCurrentMember();
    if (!member?.isActive) return { success: false, error: "Not authorised." };
    if (winnerId === loserId) return { success: false, error: "Pick two different hotels." };

    const fks = await referencingColumns();

    try {
        const moved = await db.$transaction(async (tx) => {
            const exists = await tx.hotels.count({ where: { id: { in: [winnerId, loserId] } } });
            if (exists !== 2) throw new Error("One of those hotels no longer exists.");

            // Suffix any room slug that would collide, before the rooms move.
            const clashes = await tx.$queryRaw<{ id: number; slug: string }[]>`
                SELECT l.id, l.slug FROM hotel_rooms l
                WHERE l.hotel_id = ${loserId}
                  AND EXISTS (SELECT 1 FROM hotel_rooms w WHERE w.hotel_id = ${winnerId} AND w.slug = l.slug)`;
            for (const c of clashes) {
                await tx.hotel_rooms.update({
                    where: { id: c.id },
                    // The id is what every rate and reservation actually points
                    // at, so a renamed slug costs nothing downstream.
                    data: { slug: `${c.slug}-merged-${loserId}` },
                });
            }

            let count = 0;
            for (const fk of fks) {
                const n = await tx.$executeRawUnsafe(
                    `UPDATE ${ident(fk.tbl)} SET ${ident(fk.col)} = $1 WHERE ${ident(fk.col)} = $2`,
                    winnerId, loserId);
                count += n;
            }

            // Prove it before deleting, rather than trusting the counts above.
            for (const fk of fks) {
                const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
                    `SELECT COUNT(*)::bigint AS n FROM ${ident(fk.tbl)} WHERE ${ident(fk.col)} = $1`, loserId);
                if (Number(n) > 0) throw new Error(`${fk.tbl} still references hotel ${loserId} — merge rolled back.`);
            }

            // ── Fields that live on the hotels row itself ──────────────────
            // Child rows move, but description, address, contact details and
            // coordinates would die with the deleted record — including when the
            // winner has none and the quick-created stub does. Only ever fills a
            // blank on the winner; nothing it already has is overwritten.
            const [w, l] = await Promise.all([winnerId, loserId].map((id) =>
                tx.hotels.findUniqueOrThrow({
                    where: { id },
                    select: {
                        description: true, address: true, city: true, state: true, country: true,
                        pincode: true, thumbnail: true, stay_type: true, category: true,
                        latitude: true, longitude: true, location_id: true,
                        business_phone: true, business_email: true, whatsapp_number: true,
                        check_in_time: true, check_out_time: true, destination_id: true,
                    },
                })));
            const salvage: Record<string, unknown> = {};
            for (const [k, loserValue] of Object.entries(l)) {
                const winnerValue = (w as Record<string, unknown>)[k];
                const winnerBlank = winnerValue === null || winnerValue === "";
                const loserHas = loserValue !== null && loserValue !== "";
                if (winnerBlank && loserHas) salvage[k] = loserValue;
            }
            // location_id is the one that must not be copied: it points at a
            // Location row named for the loser, which is deleted just below.
            delete salvage.location_id;
            if (Object.keys(salvage).length > 0) {
                await tx.hotels.update({ where: { id: winnerId }, data: salvage });
            }

            // The loser's own HOTEL-type Location row (slug "hotel-<id>") has
            // nothing left pointing at it once the hotel goes, and this codebase
            // already has more orphaned gazetteer rows than it wants.
            const loserLocationId = l.location_id;

            await tx.hotels.delete({ where: { id: loserId } });

            if (loserLocationId != null) {
                const stillUsed = await tx.hotels.count({ where: { location_id: loserLocationId } });
                if (stillUsed === 0) {
                    await tx.location.deleteMany({ where: { id: loserLocationId, type: "HOTEL" } });
                }
            }
            return count;
        });

        revalidatePath("/dashboard/hotels");
        revalidatePath("/dashboard/hotel-requests/catalog");
        return { success: true, movedRows: moved };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Merge failed." };
    }
}
