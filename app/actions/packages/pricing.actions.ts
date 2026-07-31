"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import {
  computePackagePrice,
  type PricingInput,
} from "@/app/services/package-pricing.service";
import { roomTotalCapacity } from "@/app/lib/room-capacity";

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
      })),
    };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to load pricing configurations" };
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
