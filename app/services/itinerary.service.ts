import "server-only";
import { db } from "@/app/lib/db";
import { Ok, Err, Result } from "@/app/lib/result";
import type { ItineraryDayView, ItineraryGrid } from "@/app/types/packages";
import type {
  UpsertItineraryDayDTO,
  FullDayItineraryDTO,
  AddStayDTO,
  AddActivityDTO,
  AddTransferDTO,
  AddNoteDTO,
  ReorderTimelineDTO,
} from "@/app/lib/validators/packages";

// ── Internal types ────────────────────────────────────────────────────────────

export type ItineraryValidationResult = {
  is_complete: boolean;
  total_days: number;
  configured_days: number;
  missing_days: number[];
  days_without_stays: number[];
  warnings: string[];
};

type DayMapping = {
  day: number;
  destination_name: string;
  is_departure: boolean;
};

// ── Private helpers ───────────────────────────────────────────────────────────

function buildDayMapping(
  stops: Array<{ destination: { name: string }; stay_days: number }>,
  total_days: number
): DayMapping[] {
  const mapping: DayMapping[] = [];
  let day = 1;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const isLast = i === stops.length - 1;

    for (let n = 1; n <= stop.stay_days; n++) {
      if (day > total_days) break;
      const isFirstAtStop = n === 1;
      mapping.push({
        day,
        destination_name: stop.destination.name,
        is_departure: false,
        ...(isFirstAtStop && i > 0
          ? { label: `Travel to ${stop.destination.name}` }
          : {}),
      });
      day++;
    }

    if (isLast && day <= total_days) {
      mapping.push({
        day,
        destination_name: stop.destination.name,
        is_departure: true,
      });
      day++;
    }
  }

  return mapping;
}

function defaultTitle(mapping: DayMapping): string {
  if (mapping.is_departure) return `Departure`;
  return `Day ${mapping.day}: ${mapping.destination_name}`;
}

// ── generateDays ──────────────────────────────────────────────────────────────
// Auto-creates placeholder itinerary records for all days in a duration/route.
// Skips days that already exist. Safe to call multiple times (idempotent).

async function generateDays(
  packageId: number,
  durationId: number,
  routeId: number
): Promise<Result<{ created: number; skipped: number }>> {
  // Load duration + route + stops
  const [duration, route] = await Promise.all([
    db.package_durations.findUnique({
      where: { id: durationId },
      select: { days: true, nights: true, package_id: true },
    }),
    db.package_routes.findUnique({
      where: { id: routeId },
      select: {
        duration_id: true,
        stops: {
          orderBy: { sort_order: "asc" },
          select: {
            stay_days: true,
            sort_order: true,
            destination: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  if (!duration) return Result.notFound("Duration");
  if (!route) return Result.notFound("Route");
  if (duration.package_id !== packageId) {
    return Err("VALIDATION_ERROR", "Duration does not belong to this package");
  }
  if (route.duration_id !== durationId) {
    return Err("VALIDATION_ERROR", "Route does not belong to this duration");
  }

  const totalStayDays = route.stops.reduce((s, stop) => s + stop.stay_days, 0);
  if (totalStayDays !== duration.nights) {
    return Err(
      "VALIDATION_ERROR",
      `Route stop stay_days sum (${totalStayDays}) must equal duration nights (${duration.nights})`
    );
  }

  const dayMappings = buildDayMapping(route.stops, duration.days);

  // Find which days already exist
  const existing = await db.package_itineraries.findMany({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId },
    select: { day: true },
  });
  const existingDays = new Set(existing.map((e) => e.day));

  const toCreate = dayMappings.filter((m) => !existingDays.has(m.day));

  if (toCreate.length === 0) {
    return Ok({ created: 0, skipped: existing.length });
  }

  await db.package_itineraries.createMany({
    data: toCreate.map((m) => ({
      package_id: packageId,
      duration_id: durationId,
      route_id: routeId,
      day: m.day,
      title: defaultTitle(m),
      description: null,
    })),
    skipDuplicates: true,
  });

  return Ok({ created: toCreate.length, skipped: existingDays.size });
}

// ── getGrid ───────────────────────────────────────────────────────────────────
// Returns all itinerary days with full sub-item data + missing day numbers.

async function getGrid(
  packageId: number,
  durationId: number,
  routeId: number
): Promise<Result<ItineraryGrid>> {
  const duration = await db.package_durations.findUnique({
    where: { id: durationId },
    select: { days: true },
  });
  if (!duration) return Result.notFound("Duration");

  const days = await db.package_itineraries.findMany({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId },
    orderBy: { day: "asc" },
    include: {
      itineraryStays: {
        orderBy: { sort_order: "asc" },
        include: {
          stay_category: { select: { id: true, label: true, slug: true } },
          room_pricing: {
            include: {
              hotel: {
                select: { id: true, name: true, slug: true, star_rating: true, category: true },
              },
              room: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
      itinerary_activities: {
        orderBy: { sort_order: "asc" },
        include: {
          activity: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              duration_hours: true,
              category: true,
            },
          },
        },
      },
      itinerary_transfers: { orderBy: { sort_order: "asc" } },
      itinerary_notes: { orderBy: { sort_order: "asc" } },
    },
  });

  const configuredDayNumbers = new Set(days.map((d) => d.day));
  const missing_days: number[] = [];
  for (let i = 1; i <= duration.days; i++) {
    if (!configuredDayNumbers.has(i)) missing_days.push(i);
  }

  return Ok({
    total_days: duration.days,
    days: days as unknown as ItineraryDayView[],
    missing_days,
  });
}

// ── upsertDay ─────────────────────────────────────────────────────────────────
// Creates or updates a single itinerary day record (header only).

async function upsertDay(
  dto: UpsertItineraryDayDTO
): Promise<Result<{ id: number }>> {
  // Verify the route belongs to this duration
  const route = await db.package_routes.findFirst({
    where: { id: dto.route_id, duration_id: dto.duration_id },
    select: { id: true },
  });
  if (!route) {
    return Err("VALIDATION_ERROR", "Route does not belong to the specified duration");
  }

  try {
    const record = await db.package_itineraries.upsert({
      where: {
        package_id_duration_id_route_id_day: {
          package_id: dto.package_id,
          duration_id: dto.duration_id,
          route_id: dto.route_id,
          day: dto.day,
        },
      },
      create: {
        package_id: dto.package_id,
        duration_id: dto.duration_id,
        route_id: dto.route_id,
        day: dto.day,
        title: dto.title,
        description: dto.description ?? null,
      },
      update: {
        title: dto.title,
        description: dto.description ?? null,
      },
      select: { id: true },
    });
    return Ok({ id: record.id });
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── saveFullDay ───────────────────────────────────────────────────────────────
// Atomically replaces ALL sub-items for a day.
// Pattern: upsert day header → delete old sub-items → insert new ones.

async function saveFullDay(dto: FullDayItineraryDTO): Promise<Result<{ id: number }>> {
  // 1. Validate route/duration ownership
  const route = await db.package_routes.findFirst({
    where: { id: dto.route_id, duration_id: dto.duration_id },
    select: { id: true },
  });
  if (!route) {
    return Err("VALIDATION_ERROR", "Route does not belong to the specified duration");
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Upsert the day header
      const itinerary = await tx.package_itineraries.upsert({
        where: {
          package_id_duration_id_route_id_day: {
            package_id: dto.package_id,
            duration_id: dto.duration_id,
            route_id: dto.route_id,
            day: dto.day,
          },
        },
        create: {
          package_id: dto.package_id,
          duration_id: dto.duration_id,
          route_id: dto.route_id,
          day: dto.day,
          title: dto.title,
          description: dto.description ?? null,
        },
        update: {
          title: dto.title,
          description: dto.description ?? null,
        },
        select: { id: true },
      });

      const itinerary_id = itinerary.id;

      // Replace all sub-items atomically
      await Promise.all([
        tx.itinerary_activities.deleteMany({ where: { itinerary_id } }),
        tx.itinerary_transfers.deleteMany({ where: { itinerary_id } }),
        tx.itinerary_notes.deleteMany({ where: { itinerary_id } }),
        tx.itinerary_stays.deleteMany({ where: { itinerary_id } }),
      ]);

      // Insert new sub-items
      const inserts: Promise<unknown>[] = [];

      if (dto.stays.length > 0) {
        inserts.push(
          tx.itinerary_stays.createMany({
            data: dto.stays.map((s) => ({
              itinerary_id,
              stay_category_id: s.stay_category_id,
              room_pricing_id: s.room_pricing_id,
              sort_order: s.sort_order,
            })),
          })
        );
      }

      if (dto.activities.length > 0) {
        inserts.push(
          tx.itinerary_activities.createMany({
            data: dto.activities.map((a) => ({
              itinerary_id,
              activity_id: a.activity_id,
              sort_order: a.sort_order,
              is_optional: a.is_optional,
            })),
          })
        );
      }

      if (dto.transfers.length > 0) {
        inserts.push(
          tx.itinerary_transfers.createMany({
            data: dto.transfers.map((t) => ({
              itinerary_id,
              cab_type: t.cab_type ?? null,
              pickup_point: t.pickup_point ?? null,
              drop_point: t.drop_point ?? null,
              duration_text: t.duration_text ?? null,
              sort_order: t.sort_order,
            })),
          })
        );
      }

      if (dto.notes.length > 0) {
        inserts.push(
          tx.itinerary_notes.createMany({
            data: dto.notes.map((n) => ({
              itinerary_id,
              message: n.message,
              type: n.type,
              position: n.position,
              optional_link_text: n.optional_link_text ?? null,
              optional_link_url: n.optional_link_url ?? null,
              sort_order: n.sort_order,
            })),
          })
        );
      }

      await Promise.all(inserts);

      return itinerary;
    });

    return Ok({ id: result.id });
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── validateItinerary ─────────────────────────────────────────────────────────
// Checks completeness: every day must exist and have at least one stay.

async function validateItinerary(
  packageId: number,
  durationId: number,
  routeId: number
): Promise<Result<ItineraryValidationResult>> {
  const duration = await db.package_durations.findUnique({
    where: { id: durationId },
    select: { days: true },
  });
  if (!duration) return Result.notFound("Duration");

  const days = await db.package_itineraries.findMany({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId },
    select: {
      day: true,
      _count: { select: { itineraryStays: true } },
    },
    orderBy: { day: "asc" },
  });

  const configuredDays = new Set(days.map((d) => d.day));
  const missing_days: number[] = [];
  for (let i = 1; i <= duration.days; i++) {
    if (!configuredDays.has(i)) missing_days.push(i);
  }

  // Days that exist but have no stays (last day / departure excluded by convention)
  const days_without_stays = days
    .filter((d) => d._count.itineraryStays === 0 && d.day < duration.days)
    .map((d) => d.day);

  const warnings: string[] = [];
  if (missing_days.length > 0) {
    warnings.push(`${missing_days.length} day(s) have no itinerary record.`);
  }
  if (days_without_stays.length > 0) {
    warnings.push(
      `Day(s) ${days_without_stays.join(", ")} have no stay assigned.`
    );
  }

  return Ok({
    is_complete: missing_days.length === 0 && days_without_stays.length === 0,
    total_days: duration.days,
    configured_days: days.length,
    missing_days,
    days_without_stays,
    warnings,
  });
}

// ── Single sub-item mutations (used from individual editors) ──────────────────

async function addStay(dto: AddStayDTO): Promise<Result<{ id: number }>> {
  try {
    const stay = await db.itinerary_stays.create({
      data: {
        itinerary_id: dto.itinerary_id,
        stay_category_id: dto.stay_category_id,
        room_pricing_id: dto.room_pricing_id,
        sort_order: dto.sort_order,
      },
      select: { id: true },
    });
    return Ok(stay);
  } catch (err) {
    // Unique constraint: one stay per category per day
    if ((err as { code?: string }).code === "P2002") {
      return Result.conflict(
        "A stay for this category already exists on this day"
      );
    }
    return Result.dbError(err);
  }
}

async function removeStay(stayId: number): Promise<Result<void>> {
  try {
    await db.itinerary_stays.delete({ where: { id: stayId } });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function addActivity(dto: AddActivityDTO): Promise<Result<{ id: number }>> {
  try {
    const act = await db.itinerary_activities.create({
      data: {
        itinerary_id: dto.itinerary_id,
        activity_id: dto.activity_id,
        sort_order: dto.sort_order,
        is_optional: dto.is_optional,
      },
      select: { id: true },
    });
    return Ok(act);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function addTransfer(dto: AddTransferDTO): Promise<Result<{ id: number }>> {
  try {
    const transfer = await db.itinerary_transfers.create({
      data: {
        itinerary_id: dto.itinerary_id,
        cab_type: dto.cab_type ?? null,
        pickup_point: dto.pickup_point ?? null,
        drop_point: dto.drop_point ?? null,
        duration_text: dto.duration_text ?? null,
        sort_order: dto.sort_order,
      },
      select: { id: true },
    });
    return Ok(transfer);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function addNote(dto: AddNoteDTO): Promise<Result<{ id: number }>> {
  try {
    const note = await db.itinerary_notes.create({
      data: {
        itinerary_id: dto.itinerary_id,
        message: dto.message,
        type: dto.type,
        position: dto.position,
        optional_link_text: dto.optional_link_text ?? null,
        optional_link_url: dto.optional_link_url ?? null,
        sort_order: dto.sort_order,
      },
      select: { id: true },
    });
    return Ok(note);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function removeActivity(activityId: number): Promise<Result<void>> {
  try {
    await db.itinerary_activities.delete({ where: { id: activityId } });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function removeTransfer(transferId: number): Promise<Result<void>> {
  try {
    await db.itinerary_transfers.delete({ where: { id: transferId } });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function removeNote(noteId: number): Promise<Result<void>> {
  try {
    await db.itinerary_notes.delete({ where: { id: noteId } });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── Reorder timeline items ────────────────────────────────────────────────────
// Accepts a flat ordered list of {kind, id, sort_order} across all sub-tables
// and batch-updates each row's sort_order in a single transaction.

async function reorderTimeline(dto: ReorderTimelineDTO): Promise<Result<void>> {
  try {
    await db.$transaction(
      dto.items.map((item) => {
        const where = { id: item.id };
        const data = { sort_order: item.sort_order };

        switch (item.kind) {
          case "stay":
            return db.itinerary_stays.update({ where, data });
          case "activity":
            return db.itinerary_activities.update({ where, data });
          case "transfer":
            return db.itinerary_transfers.update({ where, data });
          case "note":
            return db.itinerary_notes.update({ where, data });
        }
      })
    );
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export const itineraryService = {
  generateDays,
  getGrid,
  upsertDay,
  saveFullDay,
  validateItinerary,
  addStay,
  removeStay,
  addActivity,
  removeActivity,
  addTransfer,
  removeTransfer,
  addNote,
  removeNote,
  reorderTimeline,
};
