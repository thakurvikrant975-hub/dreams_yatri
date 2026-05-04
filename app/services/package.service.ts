import "server-only";
import { db } from "@/app/lib/db";
import { Ok, Err, Result } from "@/app/lib/result";
import type { PackageListItem, PackageWithRelations } from "@/app/types/packages";
import type { PaginatedResult } from "@/app/types/common.types";
import type {
  CreatePackageDTO,
  UpdatePackageDTO,
  CreateDurationDTO,
  UpdateDurationDTO,
  CreateStayCategoryDTO,
  UpdateStayCategoryDTO,
  CreateRouteDTO,
  UpdateRouteDTO,
  ReorderStopsDTO,
} from "@/app/lib/validators/packages";

// ── List input ────────────────────────────────────────────────────────────────

export type ListPackagesInput = {
  page?: number;
  limit?: number;
  search?: string;
  destination_id?: number;
  is_active?: boolean;
};

// ── listPackages ──────────────────────────────────────────────────────────────

async function listPackages(
  params: ListPackagesInput = {}
): Promise<PaginatedResult<PackageListItem>> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = {
    ...(params.is_active !== undefined && { is_active: params.is_active }),
    ...(params.destination_id && { destination_id: params.destination_id }),
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: "insensitive" as const } },
        { slug: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.packages.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        is_active: true,
        created_at: true,
        destination: { select: { id: true, name: true, slug: true } },
        durations: {
          where: { is_active: true },
          orderBy: { sort_order: "asc" },
          select: {
            id: true,
            label: true,
            days: true,
            nights: true,
            is_default: true,
          },
        },
        _count: { select: { bookings: true } },
      },
    }),
    db.packages.count({ where }),
  ]);

  return {
    data: data as PackageListItem[],
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ── getPackageById ────────────────────────────────────────────────────────────

async function getPackageById(id: number): Promise<Result<PackageWithRelations>> {
  const pkg = await db.packages.findUnique({
    where: { id },
    include: {
      destination: { select: { id: true, name: true, slug: true } },
      durations: {
        orderBy: { sort_order: "asc" },
      },
      packageRoutes: {
        orderBy: { sort_order: "asc" },
        include: {
          stops: {
            orderBy: { sort_order: "asc" },
            include: {
              destination: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
      stay_categories: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
      },
      packagePricings: true,
      cabOptions: {
        where: { is_active: true },
        orderBy: { is_default: "desc" },
      },
    },
  });

  if (!pkg) return Result.notFound("Package");
  return Ok(pkg as unknown as PackageWithRelations);
}

// ── createPackage ─────────────────────────────────────────────────────────────

async function createPackage(
  dto: CreatePackageDTO
): Promise<Result<{ id: number }>> {
  // Slug uniqueness check
  const existing = await db.packages.findUnique({
    where: { slug: dto.slug },
    select: { id: true },
  });
  if (existing) {
    return Result.conflict(`Slug "${dto.slug}" is already taken`);
  }

  try {
    const pkg = await db.$transaction(async (tx) => {
      const created = await tx.packages.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          destination_id: dto.destination_id,
          description: dto.description ?? null,
          thumbnail: dto.thumbnail || null,
          inclusions: dto.inclusions,
          exclusions: dto.exclusions,
          is_active: dto.is_active,
        },
        select: { id: true },
      });

      const id = created.id;

      // Connect many-to-many relations
      const relations: Promise<unknown>[] = [];

      if (dto.tag_ids.length > 0) {
        relations.push(
          tx.package_tags.createMany({
            data: dto.tag_ids.map((tag_id) => ({ package_id: id, tag_id })),
            skipDuplicates: true,
          })
        );
      }

      if (dto.category_ids.length > 0) {
        relations.push(
          tx.package_categories.createMany({
            data: dto.category_ids.map((category_id) => ({
              package_id: id,
              category_id,
            })),
            skipDuplicates: true,
          })
        );
      }

      if (dto.policy_ids.length > 0) {
        relations.push(
          tx.package_policy_map.createMany({
            data: dto.policy_ids.map((policy_id) => ({
              package_id: id,
              policy_id,
            })),
            skipDuplicates: true,
          })
        );
      }

      await Promise.all(relations);
      return created;
    });

    return Ok({ id: pkg.id });
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── updatePackage ─────────────────────────────────────────────────────────────

async function updatePackage(
  id: number,
  dto: UpdatePackageDTO
): Promise<Result<void>> {
  // Slug uniqueness (exclude self)
  if (dto.slug) {
    const conflict = await db.packages.findFirst({
      where: { slug: dto.slug, NOT: { id } },
      select: { id: true },
    });
    if (conflict) {
      return Result.conflict(`Slug "${dto.slug}" is already taken`);
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.packages.update({
        where: { id },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.destination_id && { destination_id: dto.destination_id }),
          ...(dto.description !== undefined && { description: dto.description ?? null }),
          ...(dto.thumbnail !== undefined && { thumbnail: dto.thumbnail || null }),
          ...(dto.inclusions && { inclusions: dto.inclusions }),
          ...(dto.exclusions && { exclusions: dto.exclusions }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        },
      });

      // Replace many-to-many relations when provided
      const replaces: Promise<unknown>[] = [];

      if (dto.tag_ids !== undefined) {
        replaces.push(
          tx.package_tags.deleteMany({ where: { package_id: id } }).then(() =>
            dto.tag_ids!.length > 0
              ? tx.package_tags.createMany({
                  data: dto.tag_ids!.map((tag_id) => ({ package_id: id, tag_id })),
                })
              : null
          )
        );
      }

      if (dto.category_ids !== undefined) {
        replaces.push(
          tx.package_categories
            .deleteMany({ where: { package_id: id } })
            .then(() =>
              dto.category_ids!.length > 0
                ? tx.package_categories.createMany({
                    data: dto.category_ids!.map((category_id) => ({
                      package_id: id,
                      category_id,
                    })),
                  })
                : null
            )
        );
      }

      if (dto.policy_ids !== undefined) {
        replaces.push(
          tx.package_policy_map
            .deleteMany({ where: { package_id: id } })
            .then(() =>
              dto.policy_ids!.length > 0
                ? tx.package_policy_map.createMany({
                    data: dto.policy_ids!.map((policy_id) => ({
                      package_id: id,
                      policy_id,
                    })),
                  })
                : null
            )
        );
      }

      await Promise.all(replaces);
    });

    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── Duration management ───────────────────────────────────────────────────────

async function createDuration(
  dto: CreateDurationDTO
): Promise<Result<{ id: number }>> {
  const existing = await db.package_durations.findUnique({
    where: {
      package_id_slug: { package_id: dto.package_id, slug: dto.slug },
    },
    select: { id: true },
  });
  if (existing) return Result.conflict(`Duration slug "${dto.slug}" already exists`);

  // If this is the default, unset other defaults
  try {
    const duration = await db.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.package_durations.updateMany({
          where: { package_id: dto.package_id },
          data: { is_default: false },
        });
      }
      return tx.package_durations.create({
        data: {
          package_id: dto.package_id,
          slug: dto.slug,
          label: dto.label,
          days: dto.days,
          nights: dto.nights,
          is_default: dto.is_default,
          sort_order: dto.sort_order,
          is_active: dto.is_active,
          thumbnail_url: dto.thumbnail_url || null,
        },
        select: { id: true },
      });
    });
    return Ok({ id: duration.id });
  } catch (err) {
    return Result.dbError(err);
  }
}

async function updateDuration(
  id: number,
  dto: UpdateDurationDTO
): Promise<Result<void>> {
  const duration = await db.package_durations.findUnique({
    where: { id },
    select: { package_id: true },
  });
  if (!duration) return Result.notFound("Duration");

  if (dto.slug) {
    const conflict = await db.package_durations.findFirst({
      where: {
        package_id: duration.package_id,
        slug: dto.slug,
        NOT: { id },
      },
      select: { id: true },
    });
    if (conflict) return Result.conflict(`Duration slug "${dto.slug}" already exists`);
  }

  try {
    await db.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.package_durations.updateMany({
          where: { package_id: duration.package_id, NOT: { id } },
          data: { is_default: false },
        });
      }
      await tx.package_durations.update({
        where: { id },
        data: {
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.label && { label: dto.label }),
          ...(dto.days && { days: dto.days }),
          ...(dto.nights !== undefined && { nights: dto.nights }),
          ...(dto.is_default !== undefined && { is_default: dto.is_default }),
          ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
          ...(dto.thumbnail_url !== undefined && {
            thumbnail_url: dto.thumbnail_url || null,
          }),
        },
      });
    });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function deleteDuration(id: number): Promise<Result<void>> {
  // Prevent deleting a duration that has bookings attached via its package
  const duration = await db.package_durations.findUnique({
    where: { id },
    select: {
      _count: { select: { itineraries: true, routes: true, pricing: true } },
    },
  });
  if (!duration) return Result.notFound("Duration");

  try {
    await db.package_durations.delete({ where: { id } });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── Stay category management ──────────────────────────────────────────────────

async function createStayCategory(
  dto: CreateStayCategoryDTO
): Promise<Result<{ id: number }>> {
  const existing = await db.package_stay_categories.findUnique({
    where: {
      package_id_slug: { package_id: dto.package_id, slug: dto.slug },
    },
    select: { id: true },
  });
  if (existing) return Result.conflict(`Stay category slug "${dto.slug}" already exists`);

  try {
    const cat = await db.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.package_stay_categories.updateMany({
          where: { package_id: dto.package_id },
          data: { is_default: false },
        });
      }
      return tx.package_stay_categories.create({
        data: {
          package_id: dto.package_id,
          slug: dto.slug,
          label: dto.label,
          description: dto.description ?? null,
          min_duration_days: dto.min_duration_days ?? null,
          is_default: dto.is_default,
          sort_order: dto.sort_order,
          is_active: dto.is_active,
        },
        select: { id: true },
      });
    });
    return Ok({ id: cat.id });
  } catch (err) {
    return Result.dbError(err);
  }
}

async function updateStayCategory(
  id: number,
  dto: UpdateStayCategoryDTO
): Promise<Result<void>> {
  const cat = await db.package_stay_categories.findUnique({
    where: { id },
    select: { package_id: true },
  });
  if (!cat) return Result.notFound("Stay category");

  try {
    await db.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.package_stay_categories.updateMany({
          where: { package_id: cat.package_id, NOT: { id } },
          data: { is_default: false },
        });
      }
      await tx.package_stay_categories.update({
        where: { id },
        data: {
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.label && { label: dto.label }),
          ...(dto.description !== undefined && { description: dto.description ?? null }),
          ...(dto.min_duration_days !== undefined && {
            min_duration_days: dto.min_duration_days ?? null,
          }),
          ...(dto.is_default !== undefined && { is_default: dto.is_default }),
          ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        },
      });
    });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── Route management ──────────────────────────────────────────────────────────

async function createRoute(dto: CreateRouteDTO): Promise<Result<{ id: number }>> {
  // Verify duration exists and belongs to the right package
  const duration = await db.package_durations.findUnique({
    where: { id: dto.duration_id },
    select: { package_id: true, nights: true },
  });
  if (!duration) return Result.notFound("Duration");

  // Validate that stop stay_days sum matches duration nights
  const totalStayDays = dto.stops.reduce((s, stop) => s + stop.stay_days, 0);
  if (totalStayDays !== duration.nights) {
    return Err(
      "VALIDATION_ERROR",
      `Stop stay_days total (${totalStayDays}) must equal duration nights (${duration.nights})`
    );
  }

  // Slug uniqueness within this duration
  const conflict = await db.package_routes.findUnique({
    where: { duration_id_slug: { duration_id: dto.duration_id, slug: dto.slug } },
    select: { id: true },
  });
  if (conflict) return Result.conflict(`Route slug "${dto.slug}" already exists for this duration`);

  try {
    const route = await db.$transaction(async (tx) => {
      const created = await tx.package_routes.create({
        data: {
          duration_id: dto.duration_id,
          name: dto.name,
          slug: dto.slug,
          meta_title: dto.meta_title ?? null,
          meta_desc: dto.meta_desc ?? null,
          sort_order: dto.sort_order,
          is_active: dto.is_active,
          total_distance_km: dto.total_distance_km ?? null,
          total_duration_min: dto.total_duration_min ?? null,
        },
        select: { id: true },
      });

      await tx.route_stops.createMany({
        data: dto.stops.map((stop) => ({
          route_id: created.id,
          destination_id: stop.destination_id,
          stay_days: stop.stay_days,
          sort_order: stop.sort_order,
          latitude: stop.latitude ?? null,
          longitude: stop.longitude ?? null,
        })),
      });

      return created;
    });

    return Ok({ id: route.id });
  } catch (err) {
    return Result.dbError(err);
  }
}

async function updateRoute(
  id: number,
  dto: UpdateRouteDTO
): Promise<Result<void>> {
  const route = await db.package_routes.findUnique({
    where: { id },
    select: { duration_id: true },
  });
  if (!route) return Result.notFound("Route");

  // Validate stay_days sum if stops are being replaced
  if (dto.stops) {
    const duration = await db.package_durations.findUnique({
      where: { id: route.duration_id },
      select: { nights: true },
    });
    const total = dto.stops.reduce((s, stop) => s + stop.stay_days, 0);
    if (duration && total !== duration.nights) {
      return Err(
        "VALIDATION_ERROR",
        `Stop stay_days total (${total}) must equal duration nights (${duration.nights})`
      );
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.package_routes.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.meta_title !== undefined && { meta_title: dto.meta_title ?? null }),
          ...(dto.meta_desc !== undefined && { meta_desc: dto.meta_desc ?? null }),
          ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
          ...(dto.total_distance_km !== undefined && {
            total_distance_km: dto.total_distance_km ?? null,
          }),
          ...(dto.total_duration_min !== undefined && {
            total_duration_min: dto.total_duration_min ?? null,
          }),
        },
      });

      if (dto.stops) {
        // Replace all stops atomically
        await tx.route_stops.deleteMany({ where: { route_id: id } });
        await tx.route_stops.createMany({
          data: dto.stops.map((stop) => ({
            route_id: id,
            destination_id: stop.destination_id,
            stay_days: stop.stay_days,
            sort_order: stop.sort_order,
            latitude: stop.latitude ?? null,
            longitude: stop.longitude ?? null,
          })),
        });
      }
    });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

async function deleteRoute(id: number): Promise<Result<void>> {
  const route = await db.package_routes.findUnique({
    where: { id },
    select: {
      _count: { select: { itineraries: true } },
    },
  });
  if (!route) return Result.notFound("Route");

  if (route._count.itineraries > 0) {
    return Err(
      "CONFLICT",
      `Cannot delete route — it has ${route._count.itineraries} itinerary day(s). Delete the itinerary first.`
    );
  }

  try {
    await db.package_routes.delete({ where: { id } });
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── reorderStops ──────────────────────────────────────────────────────────────
// Used by drag-and-drop stop reordering in the UI.

async function reorderStops(dto: ReorderStopsDTO): Promise<Result<void>> {
  try {
    await db.$transaction(
      dto.stops.map((stop) =>
        db.route_stops.update({
          where: { id: stop.id },
          data: { sort_order: stop.sort_order },
        })
      )
    );
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── getDestinationsForSelect ──────────────────────────────────────────────────

async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      region: { select: { name: true } },
    },
  });
}

// ── getPolicies ───────────────────────────────────────────────────────────────

async function getPolicies() {
  return db.policies.findMany({
    where: { is_active: true },
    orderBy: [{ type: "asc" }, { sort_order: "asc" }],
    select: { id: true, type: true, title: true, points: true },
  });
}

// ── getPackagePolicies ────────────────────────────────────────────────────────

async function getPackagePolicies(packageId: number) {
  const rows = await db.package_policy_map.findMany({
    where: { package_id: packageId },
    select: { policy_id: true },
  });
  return rows.map((r) => r.policy_id);
}

// ── setPackagePolicies ────────────────────────────────────────────────────────

async function setPackagePolicies(
  packageId: number,
  policyIds: number[]
): Promise<Result<void>> {
  try {
    await db.$transaction([
      db.package_policy_map.deleteMany({ where: { package_id: packageId } }),
      ...(policyIds.length > 0
        ? [
            db.package_policy_map.createMany({
              data: policyIds.map((policy_id) => ({ package_id: packageId, policy_id })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    return Ok(undefined);
  } catch (err) {
    return Result.dbError(err);
  }
}

// ── getRoomPricingForStayCategories ──────────────────────────────────────────
// Returns hotel room pricing options for use in the itinerary palette.

async function getRoomPricingForStayCategories(
  packageId: number,
  stayCategoryIds: number[]
) {
  // Get destinations that are in any route of this package to filter hotels
  const routes = await db.package_routes.findMany({
    where: { duration: { package_id: packageId } },
    select: {
      stops: { select: { destination_id: true } },
    },
  });
  const destinationIds = [
    ...new Set(routes.flatMap((r) => r.stops.map((s) => s.destination_id))),
  ];

  return db.hotel_room_pricing.findMany({
    where: {
      hotel: {
        destination_id: { in: destinationIds },
        is_active: true,
      },
    },
    select: {
      id: true,
      price_per_night: true,
      hotel: {
        select: {
          id: true,
          name: true,
          slug: true,
          star_rating: true,
          category: true,
          destination: { select: { id: true, name: true } },
        },
      },
      room: { select: { id: true, name: true } },
    },
    orderBy: [
      { hotel: { destination: { name: "asc" } } },
      { hotel: { name: "asc" } },
    ],
  });
}

// ── getActivitiesForDestination ───────────────────────────────────────────────

async function getActivitiesForDestination(destinationId: number) {
  return db.activities.findMany({
    where: { destination_id: destinationId, is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      duration_hours: true,
      category: true,
    },
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

export const packageService = {
  listPackages,
  getPackageById,
  createPackage,
  updatePackage,
  createDuration,
  updateDuration,
  deleteDuration,
  createStayCategory,
  updateStayCategory,
  createRoute,
  updateRoute,
  deleteRoute,
  reorderStops,
  getDestinationsForSelect,
  getPolicies,
  getPackagePolicies,
  setPackagePolicies,
  getRoomPricingForStayCategories,
  getActivitiesForDestination,
};
