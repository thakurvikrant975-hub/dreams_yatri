import "server-only";
import { db } from "@/app/lib/db";
import { Ok, Err, Result } from "@/app/lib/result";
import { CabType } from "@/app/generated/prisma";
import type {
  PackagePriceBreakdown,
  StayCostLine,
  ActivityCostLine,
  TransferCostLine,
} from "@/app/types/packages";
import type {
  SetPricingDTO,
  BulkSetPricingDTO,
  UpsertCabOptionDTO,
} from "@/app/lib/validators/packages";

// ── Input type (extends Zod DTO with route_id) ────────────────────────────────

export type PricingCalculationInput = {
  package_id: number;
  duration_id: number;
  route_id: number;
  stay_category_id: number;
  pax: number;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── calculatePackagePrice ─────────────────────────────────────────────────────
// Core invariant: price is NEVER stored. Always computed live from itinerary.

async function calculatePackagePrice(
  input: PricingCalculationInput
): Promise<Result<PackagePriceBreakdown>> {
  // 1. Load margin / GST config for this combination
  const config = await db.package_pricing.findUnique({
    where: {
      package_id_duration_id_stay_category_id: {
        package_id: input.package_id,
        duration_id: input.duration_id,
        stay_category_id: input.stay_category_id,
      },
    },
    select: { margin_percentage: true, gst_percentage: true },
  });

  if (!config) {
    return Result.notFound(
      "Pricing configuration for this duration + stay category"
    );
  }

  // 2. Load all itinerary days with their sub-items in one query
  const days = await db.package_itineraries.findMany({
    where: {
      package_id: input.package_id,
      duration_id: input.duration_id,
      route_id: input.route_id,
    },
    orderBy: { day: "asc" },
    select: {
      day: true,
      itineraryStays: {
        where: { stay_category_id: input.stay_category_id },
        select: {
          stay_category_id: true,
          room_pricing_id: true,
          stay_category: { select: { label: true } },
          room_pricing: {
            select: {
              price_per_night: true,
              hotel: { select: { name: true } },
              room: { select: { name: true } },
            },
          },
        },
      },
      itinerary_activities: {
        // Optional activities excluded from base price
        where: { is_optional: false },
        select: {
          id: true,
          activity_id: true,
          is_optional: true,
          activity: { select: { name: true, price: true } },
        },
      },
      itinerary_transfers: {
        select: {
          id: true,
          cab_type: true,
          pickup_point: true,
          drop_point: true,
        },
      },
    },
  });

  if (days.length === 0) {
    return Err(
      "NOT_FOUND",
      "No itinerary days found for the selected route and duration. Please build the itinerary first."
    );
  }

  // 3. Build stay cost lines — one line per itinerary day per stay
  const stay_lines: StayCostLine[] = days.flatMap((d) =>
    d.itineraryStays.map((stay) => {
      const price = Number(stay.room_pricing.price_per_night);
      return {
        day: d.day,
        stay_category_id: stay.stay_category_id,
        stay_category_label: stay.stay_category.label,
        room_pricing_id: stay.room_pricing_id,
        hotel_name: stay.room_pricing.hotel.name,
        room_name: stay.room_pricing.room?.name ?? null,
        price_per_night: price,
        nights: 1,
        subtotal: price,
      } satisfies StayCostLine;
    })
  );

  // 4. Build activity cost lines — mandatory only; optional shown separately
  const activity_lines: ActivityCostLine[] = days.flatMap((d) =>
    d.itinerary_activities.map((act) => {
      const price = act.activity.price ? Number(act.activity.price) : 0;
      return {
        day: d.day,
        activity_id: act.activity_id,
        activity_name: act.activity.name,
        price_per_person: price,
        pax: input.pax,
        is_optional: act.is_optional,
        subtotal: round2(price * input.pax),
      } satisfies ActivityCostLine;
    })
  );

  // 5. Build transfer lines — descriptive only (no cost stored)
  const transfer_lines: TransferCostLine[] = days.flatMap((d) =>
    d.itinerary_transfers.map((t) => ({
      day: d.day,
      transfer_id: t.id,
      cab_type: t.cab_type,
      pickup_point: t.pickup_point,
      drop_point: t.drop_point,
    } satisfies TransferCostLine))
  );

  // 6. Compute totals — NEVER stored, always derived
  const stay_subtotal = stay_lines.reduce((s, l) => s + l.subtotal, 0);
  const activity_subtotal = activity_lines.reduce((s, l) => s + l.subtotal, 0);
  const base_cost = round2(stay_subtotal + activity_subtotal);

  const margin_percentage = Number(config.margin_percentage);
  const margin_amount = round2(base_cost * (margin_percentage / 100));

  const gst_percentage = Number(config.gst_percentage);
  const gst_amount = round2((base_cost + margin_amount) * (gst_percentage / 100));

  const final_price = round2(base_cost + margin_amount + gst_amount);

  return Ok({
    stay_lines,
    activity_lines,
    transfer_lines,
    base_cost,
    margin_percentage,
    margin_amount,
    gst_percentage,
    gst_amount,
    final_price,
  });
}

// ── setPricing ────────────────────────────────────────────────────────────────
// Stores ONLY margin% and gst% — never a price amount.

async function setPricing(dto: SetPricingDTO): Promise<Result<void>> {
  try {
    await db.package_pricing.upsert({
      where: {
        package_id_duration_id_stay_category_id: {
          package_id: dto.package_id,
          duration_id: dto.duration_id,
          stay_category_id: dto.stay_category_id,
        },
      },
      create: {
        package_id: dto.package_id,
        duration_id: dto.duration_id,
        stay_category_id: dto.stay_category_id,
        margin_percentage: dto.margin_percentage,
        gst_percentage: dto.gst_percentage,
      },
      update: {
        margin_percentage: dto.margin_percentage,
        gst_percentage: dto.gst_percentage,
      },
    });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── bulkSetPricing ────────────────────────────────────────────────────────────
// Upserts all duration × stay_category combinations for a package at once.

async function bulkSetPricing(dto: BulkSetPricingDTO): Promise<Result<void>> {
  try {
    await db.$transaction(
      dto.entries.map((entry) =>
        db.package_pricing.upsert({
          where: {
            package_id_duration_id_stay_category_id: {
              package_id: dto.package_id,
              duration_id: entry.duration_id,
              stay_category_id: entry.stay_category_id,
            },
          },
          create: {
            package_id: dto.package_id,
            duration_id: entry.duration_id,
            stay_category_id: entry.stay_category_id,
            margin_percentage: entry.margin_percentage,
            gst_percentage: entry.gst_percentage,
          },
          update: {
            margin_percentage: entry.margin_percentage,
            gst_percentage: entry.gst_percentage,
          },
        })
      )
    );
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── getPricingForPackage ──────────────────────────────────────────────────────

async function getPricingForPackage(packageId: number) {
  return db.package_pricing.findMany({
    where: { package_id: packageId },
    include: {
      duration: { select: { id: true, label: true, days: true, nights: true } },
      stay_category: { select: { id: true, label: true, slug: true } },
    },
    orderBy: [
      { duration: { sort_order: "asc" } },
      { stay_category: { sort_order: "asc" } },
    ],
  });
}

// ── upsertCabOption ───────────────────────────────────────────────────────────

async function upsertCabOption(dto: UpsertCabOptionDTO): Promise<Result<void>> {
  try {
    await db.package_cab_options.upsert({
      where: {
        package_id_cab_type: {
          package_id: dto.package_id,
          cab_type: dto.cab_type as CabType,
        },
      },
      create: {
        package_id: dto.package_id,
        cab_type: dto.cab_type as CabType,
        capacity: dto.capacity,
        rate_per_cab: dto.rate_per_cab,
        is_default: dto.is_default,
        is_active: dto.is_active,
      },
      update: {
        capacity: dto.capacity,
        rate_per_cab: dto.rate_per_cab,
        is_default: dto.is_default,
        is_active: dto.is_active,
      },
    });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export const pricingService = {
  calculatePackagePrice,
  setPricing,
  bulkSetPricing,
  getPricingForPackage,
  upsertCabOption,
};
