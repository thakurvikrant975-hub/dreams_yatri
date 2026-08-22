"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import {
  computePackagePrice,
  type PricingInput,
} from "@/app/services/package-pricing.service";
import { roomTotalCapacity } from "@/app/lib/room-capacity";
import { findMarginSeasonOverlap } from "@/app/lib/package-margin-season";
import {
  ReplaceMarginSeasonsSchema,
  type ReplaceMarginSeasonsDTO,
} from "@/app/lib/validators/packages/pricing.validator";

export async function handleGetPackagePricings(packageId: number) {
  try {
    const data = await db.package_pricing.findMany({
      where: { package_id: packageId },
      select: {
        id: true,
        duration_id: true,
        stay_category_id: true,
        margin_percentage: true,
        gst_percentage: true,
        seasons: {
          orderBy: { sort_order: "asc" },
          select: {
            id: true,
            season_name: true,
            valid_from: true,
            valid_to: true,
            margin_percentage: true,
            color: true,
          },
        },
      },
    });
    return {
      success: true as const,
      data: data.map((p) => ({
        id: p.id,
        duration_id: p.duration_id,
        stay_category_id: p.stay_category_id,
        margin_percentage: Number(p.margin_percentage),
        gst_percentage: Number(p.gst_percentage),
        seasons: p.seasons.map((s) => ({
          id: String(s.id),
          season_name: s.season_name,
          valid_from: s.valid_from.toISOString().slice(0, 10),
          valid_to: s.valid_to.toISOString().slice(0, 10),
          margin_percentage: Number(s.margin_percentage),
          color: s.color,
        })),
      })),
    };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to load pricing configurations" };
  }
}

/**
 * Replaces every margin season for one package x duration x stay category.
 *
 * Whole-set replacement rather than per-season CRUD because the calendar's
 * overlap trimming can rewrite several rows in one edit (splitting a season
 * around a new one, trimming a neighbour back) — sending the resulting set as
 * one transaction is the only way the stored ranges can't end up overlapping
 * partway through. Upserts the parent config row first, so seasons can be set
 * on a combination whose base margin was never explicitly saved (it defaults
 * to the same 10% / 5% the engine would have assumed anyway).
 */
export async function handleReplaceMarginSeasons(raw: ReplaceMarginSeasonsDTO) {
  const parsed = ReplaceMarginSeasonsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid seasonal margin input",
    };
  }
  const input = parsed.data;

  // Note the calendar is year-scoped while these dates are not, so this can
  // fire on two ranges the UI drew in different years — hence spelling out
  // why they collide rather than just saying they do.
  const overlap = findMarginSeasonOverlap(input.seasons);
  if (overlap) {
    const range = (i: number) => `${input.seasons[i].valid_from} – ${input.seasons[i].valid_to}`;
    return {
      success: false as const,
      error:
        `Two margin seasons cover the same dates (${range(overlap.a)} and ${range(overlap.b)}). ` +
        `Season dates repeat every year, so ranges can't overlap even when their years differ.`,
    };
  }

  try {
    await db.$transaction(async (tx) => {
      const config = await tx.package_pricing.upsert({
        where: {
          package_id_duration_id_stay_category_id: {
            package_id: input.package_id,
            duration_id: input.duration_id,
            stay_category_id: input.stay_category_id,
          },
        },
        create: {
          package_id: input.package_id,
          duration_id: input.duration_id,
          stay_category_id: input.stay_category_id,
        },
        update: {},
        select: { id: true },
      });

      await tx.package_pricing_season.deleteMany({ where: { pricing_id: config.id } });
      if (input.seasons.length > 0) {
        await tx.package_pricing_season.createMany({
          data: input.seasons.map((s, i) => ({
            pricing_id: config.id,
            season_name: s.season_name?.trim() || null,
            // Parsed as UTC midnight so the stored month/day is the one that
            // was picked, whatever timezone the server happens to run in —
            // the engine matches on month/day, so a shift would move a season.
            valid_from: new Date(`${s.valid_from}T00:00:00Z`),
            valid_to: new Date(`${s.valid_to}T00:00:00Z`),
            margin_percentage: s.margin_percentage,
            color: s.color,
            sort_order: i,
          })),
        });
      }
    });
    revalidatePath(`/dashboard/packages/${input.package_id}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to save seasonal margins" };
  }
}

export async function handleUpsertPackagePricing(input: {
  package_id: number;
  duration_id: number;
  stay_category_id: number;
  margin_percentage: number;
  gst_percentage: number;
}) {
  try {
    await db.package_pricing.upsert({
      where: {
        package_id_duration_id_stay_category_id: {
          package_id: input.package_id,
          duration_id: input.duration_id,
          stay_category_id: input.stay_category_id,
        },
      },
      create: input,
      update: {
        margin_percentage: input.margin_percentage,
        gst_percentage: input.gst_percentage,
      },
    });
    revalidatePath(`/dashboard/packages/${input.package_id}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to save pricing configuration" };
  }
}

// Sanity-check only — the authoritative guard (can never underprice the
// derived-safe minimum) lives inside computePackagePrice itself, since that's
// the one place every caller funnels through. This just strips obviously
// malformed entries before they get there, same spirit as the adults/children
// clamping below.
function sanitizeRooms(rooms: PricingInput["rooms"]): PricingInput["rooms"] {
  if (!Array.isArray(rooms)) return undefined;
  const cleaned = rooms
    .filter((r) => r && Number.isInteger(r.adults) && Number.isInteger(r.children))
    .map((r) => ({ adults: Math.max(1, r.adults), children: Math.max(0, r.children) }))
    .slice(0, 20);
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Tightest per-room guest capacity across an itinerary's stays, so a room
 *  picker can cap its steppers at a split the pricing engine will actually
 *  honour (it re-derives the same number per stay — see the `rooms` validation
 *  in computePackagePrice). Returns null capacity when the itinerary has no
 *  hotel stays mapped, letting the caller fall back to its own default. */
export async function handleGetItineraryRoomCapacity(input: {
  package_id: number;
  duration_id: number;
  route_id: number;
  stay_category_id: number;
}) {
  try {
    const stays = await db.itinerary_stays.findMany({
      where: {
        stay_category_id: input.stay_category_id,
        itinerary: {
          package_id: input.package_id,
          duration_id: input.duration_id,
          route_id: input.route_id,
        },
      },
      select: {
        room_pricing: {
          select: {
            room: {
              select: {
                max_occupancy: true, extra_bed_capacity: true,
                max_adults: true, max_children: true, num_rooms: true,
              },
            },
          },
        },
      },
    });
    if (stays.length === 0) {
      return { success: true as const, data: { persons_per_room: null, stay_count: 0 } };
    }
    const capacities = stays.map((s) => roomTotalCapacity(s.room_pricing.room));
    return {
      success: true as const,
      data: {
        persons_per_room: Math.max(1, Math.min(...capacities)),
        stay_count: stays.length,
      },
    };
  } catch (e) {
    console.error("[handleGetItineraryRoomCapacity]", e);
    return { success: false as const, error: "Failed to load room capacity" };
  }
}

export async function handleComputePackagePrice(input: PricingInput) {
  const adults = Math.max(1, Math.floor(input.adults ?? 1));
  const children = Math.max(0, Math.floor(input.children ?? 0));
  const infants = Math.max(0, Math.floor(input.infants ?? 0));
  const rooms = sanitizeRooms(input.rooms);
  try {
    const data = await computePackagePrice({ ...input, adults, children, infants, rooms });
    return { success: true as const, data };
  } catch (err) {
    console.error("[computePackagePrice]", err);
    return { success: false as const, error: "Failed to compute package price" };
  }
}
