"use server";

import { db } from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";
import { ALL_SYSTEM_HOTEL_CATEGORIES, REQUIRED_HOTEL_CATEGORIES } from "@/app/lib/hotelImageCategories";
import { actionError } from "@/app/lib/action-error";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";

// ── Auth helper ────────────────────────────────────────────────

async function requireSession() {
  const session = await dashboardAuth();
  const actorId   = session?.user?.id   ?? null;
  const actorName = session?.user?.name ?? session?.user?.email ?? null;
  return { session, actorId, actorName };
}

const SAFE_HOTEL_SCALARS = {
  id: true, name: true, slug: true, description: true, meta_title: true, meta_desc: true,
  destination_id: true, address: true, category: true, stay_type: true,
  check_in_time: true, check_out_time: true, is_active: true, created_at: true, updated_at: true,
  thumbnail: true, city: true, state: true, country: true, pincode: true,
  business_phone: true, business_email: true, whatsapp_number: true, b2b_email: true,
  location_id: true, margin_percentage: true, gst_percentage: true,
  created_by: true, updated_by: true,
} as const;

const SAFE_HOTEL_ROOM_SCALARS = {
  id: true, hotel_id: true, name: true, slug: true,
  area_sqft: true, bed_type: true, view_type: true,
  bed_count: true, child_cot_available: true,
  max_occupancy: true, max_adults: true, max_children: true,
  extra_bed_capacity: true, amenities: true, features: true,
  bathroom: true, facilities: true, description: true,
  is_active: true, sort_order: true, created_at: true, updated_at: true,
} as const;

// ── Schemas ───────────────────────────────────────────────────────────────

const HotelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  destination_id: z.coerce.number().int().positive("Destination is required"),
  thumbnail: z.string().optional(),
  category: z.string().nullable().optional(),
  stay_type: z.string().nullable().optional(),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  business_phone: z.preprocess(
    v => {
      if (typeof v !== "string") return v;
      const s = v.replace(/\s+/g, "");
      return /^\+\d{1,4}$/.test(s) ? "" : s;
    },
    z.string().or(z.literal("")).transform(v => v === "" ? null : v).nullable().optional()
  ),
  business_email: z.string().email("Invalid email").or(z.literal("")).transform(v => v === "" ? null : v).nullable().optional(),
  whatsapp_number: z.preprocess(
    v => {
      if (typeof v !== "string") return v;
      const s = v.replace(/\s+/g, "");
      // bare dial code with no subscriber number (e.g. "+91") → treat as empty
      return /^\+\d{1,4}$/.test(s) ? "" : s;
    },
    z.string().regex(/^\+[1-9]\d{6,14}$/, "Use international format: +919876543210").or(z.literal("")).transform(v => v === "" ? null : v).nullable().optional()
  ),
  b2b_email: z.string().email("Invalid B2B email").or(z.literal("")).transform(v => v === "" ? null : v).nullable().optional(),
  description: z.string().or(z.literal("")).transform(v => v === "" ? null : v).nullable().optional(),
  meta_title: z.string().max(60, "Meta title must be 60 characters or less").nullable().optional(),
  meta_desc: z.string().max(160, "Meta description must be 160 characters or less").nullable().optional(),
  is_active: z.boolean().default(true),
  location_id: z.string().optional().nullable()
    .transform((v) => (v && v !== "" ? BigInt(v) : null)),
});

export type HotelFormState = {
  success: boolean;
  message: string;
  id?: number;
  errors?: Record<string, string[]>;
};

// ── Read ──────────────────────────────────────────────────────────────────

export type GetHotelsParams = {
  page?:        number;
  limit?:       number;
  search?:      string;
  destination?: number | "all";
  category?:    string | "all";
  status?:      "active" | "inactive" | "all";
};

const HOTEL_INCLUDE = {
  destination: { select: { id: true, name: true } },
  location: { select: { name: true, city: { select: { name: true } }, state: { select: { name: true } }, country: { select: { name: true } } } },
  _count: {
    select: {
      hotelRooms: true,
      images: true,
      packageBookings: true,
    },
  },
} as const;

export async function getHotels(params: GetHotelsParams = {}) {
  const {
    page        = 1,
    limit       = 20,
    search      = "",
    destination = "all",
    category    = "all",
    status      = "all",
  } = params;

  const skip = (page - 1) * limit;

  const where = {
    ...(search ? {
      OR: [
        { name:     { contains: search, mode: "insensitive" as const } },
        { city:     { contains: search, mode: "insensitive" as const } },
        { state:    { contains: search, mode: "insensitive" as const } },
        { country:  { contains: search, mode: "insensitive" as const } },
        { location: { name:    { contains: search, mode: "insensitive" as const } } },
        { location: { city:    { name: { contains: search, mode: "insensitive" as const } } } },
        { location: { state:   { name: { contains: search, mode: "insensitive" as const } } } },
        { location: { country: { name: { contains: search, mode: "insensitive" as const } } } },
      ],
    } : {}),
    ...(destination !== "all" ? { destination_id: destination as number } : {}),
    ...(category    !== "all" ? { category: category as string }           : {}),
    ...(status === "active"   ? { is_active: true }                        : {}),
    ...(status === "inactive" ? { is_active: false }                       : {}),
  };

  type HotelRow = Awaited<ReturnType<typeof db.hotels.findMany<{ include: typeof HOTEL_INCLUDE }>>>[number];

  const rows = await db.hotels.findMany({
    where,
    orderBy: { created_at: "desc" },
    skip,
    take: limit,
    select: { ...SAFE_HOTEL_SCALARS, ...HOTEL_INCLUDE },
  }) as HotelRow[];

  const [totalCount, statsTotal, statsActive, totalRooms] = await Promise.all([
    db.hotels.count({ where }),
    db.hotels.count(),
    db.hotels.count({ where: { is_active: true } }),
    db.hotel_rooms.count(),
  ]);

  const hotels = rows.map((h) => ({
    ...h,
    margin_percentage: Number(h.margin_percentage),
    gst_percentage:    Number(h.gst_percentage),
  }));

  const actorIds = [...new Set(hotels.flatMap((h) => [h.created_by, h.updated_by]).filter(Boolean) as string[])];
  const members = actorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return {
    hotels,
    memberNames,
    totalCount,
    stats: { total: statsTotal, active: statsActive, totalRooms },
  };
}

export async function getAllHotelsForOverview() {
  const rows = await db.hotels.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      thumbnail: true,
      category: true,
      stay_type: true,
      city: true,
      state: true,
      country: true,
      is_active: true,
      destination: { select: { name: true, latitude: true, longitude: true } },
      location: { select: { latitude: true, longitude: true, name: true } },
      _count: { select: { hotelRooms: true, images: true } },
    },
    orderBy: { name: "asc" },
  });

  return rows.map((h) => ({
    ...h,
    lat: h.location?.latitude   ? Number(h.location.latitude)
       : h.destination?.latitude ? Number(h.destination.latitude)
       : null,
    lng: h.location?.longitude   ? Number(h.location.longitude)
       : h.destination?.longitude ? Number(h.destination.longitude)
       : null,
  }));
}

export async function getDestinationsForHotelFilter() {
  return db.destinations.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getHotelHistory(id: number) {
  return db.activityLog.findMany({
    where:   { entity: "Hotel", entityId: String(id) },
    orderBy: { actionAt: "desc" },
    select: {
      id:           true,
      action:       true,
      description:  true,
      userName:     true,
      userEmail:    true,
      previousData: true,
      newData:      true,
      metadata:     true,
      status:       true,
      actionAt:     true,
    },
    take: 50,
  });
}

export async function getHotelById(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  // Guarantee required system categories exist (handles hotels created via seed or
  // before this feature was added — idempotent: only inserts what is missing).
  const existingSystemNames = await db.hotel_image_categories
    .findMany({ where: { hotel_id: id, is_system: true }, select: { name: true } })
    .then((rows) => new Set(rows.map((r) => r.name)));

  const missing = REQUIRED_HOTEL_CATEGORIES.filter((c) => !existingSystemNames.has(c.name));
  if (missing.length > 0) {
    await db.hotel_image_categories.createMany({
      data: missing.map((cat) => ({
        hotel_id: id,
        name: cat.name,
        is_required: cat.is_required,
        is_system: cat.is_system,
        sort_order: cat.sort_order,
      })),
    });
  }

  const baseInclude = {
    destination: { select: { id: true, name: true } },
    location: {
      select: {
        id: true, name: true, type: true, slug: true,
        latitude: true, longitude: true,
        state:   { select: { name: true } },
        country: { select: { name: true } },
      },
    },
    hotelRooms: {
      orderBy: { sort_order: "asc" } as const,
      include: {
        images: { orderBy: { sort_order: "asc" } as const },
        pricing: {
          orderBy: { sort_order: "asc" } as const,
          include: {
            meal_type: { select: { id: true, name: true } },
            diet_type: { select: { id: true, name: true } },
            occupancy_prices: { orderBy: { occupancy: "asc" } as const },
          },
        },
      },
    },
    childPolicies:    { orderBy: { sort_order: "asc" } as const },
    image_categories: {
      orderBy: { sort_order: "asc" } as const,
      include: {
        images:       { orderBy: { sort_order: "asc" } as const },
        room_pricing: { select: { id: true } },
      },
    },
  };

  const roomPricingWithSeasons = {
    orderBy: { sort_order: "asc" } as const,
    include: {
      room:             { select: { id: true, name: true } },
      meal_type:        { select: { id: true, name: true } },
      diet_type:        { select: { id: true, name: true } },
      occupancy_prices: { orderBy: { occupancy: "asc" } as const },
      seasons: {
        orderBy: { sort_order: "asc" } as const,
        include: { occupancy_prices: { orderBy: { occupancy: "asc" } as const } },
      },
    },
  };

  const roomPricingNoSeasons = {
    orderBy: { sort_order: "asc" } as const,
    include: {
      room:             { select: { id: true, name: true } },
      meal_type:        { select: { id: true, name: true } },
      diet_type:        { select: { id: true, name: true } },
      occupancy_prices: { orderBy: { occupancy: "asc" } as const },
    },
  };

  // Use explicit safe scalars to avoid P2022 from columns in the Prisma schema but not yet
  // migrated to production (hotels.created_by/updated_by, hotel_rooms.bed_count/child_cot_available).
  // hotelRooms is overridden with a select that excludes the missing columns; missing fields are
  // patched back with their schema defaults after the query.
  // HotelFull is derived from the original baseInclude (which uses include) so the TypeScript type
  // still knows about bed_count / child_cot_available — they're just filled in at runtime below.
  type HotelFull = Prisma.hotelsGetPayload<{
    include: typeof baseInclude & { room_pricing: typeof roomPricingWithSeasons };
  }> | null;

  // Safe hotelRooms query: selects only columns known to exist in production.
  const safeHotelRooms = {
    orderBy: { sort_order: "asc" } as const,
    select: {
      ...SAFE_HOTEL_ROOM_SCALARS,
      images: { orderBy: { sort_order: "asc" } as const },
      pricing: {
        orderBy: { sort_order: "asc" } as const,
        include: {
          meal_type: { select: { id: true, name: true } },
          diet_type: { select: { id: true, name: true } },
          occupancy_prices: { orderBy: { occupancy: "asc" } as const },
        },
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function patchRooms(rooms: any[]): any[] {
    return rooms.map((room: any) => ({
      ...room,
      bed_count:           room.bed_count           ?? 1,
      child_cot_available: room.child_cot_available ?? false,
    }));
  }

  let hotel: HotelFull = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partial = await (db.hotels.findUnique as any)({
      where: { id },
      select: { ...SAFE_HOTEL_SCALARS, ...baseInclude, hotelRooms: safeHotelRooms, room_pricing: roomPricingWithSeasons },
    });
    hotel = partial
      ? ({ ...partial, created_by: null, updated_by: null, hotelRooms: patchRooms(partial.hotelRooms ?? []) } as HotelFull)
      : null;
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err?.code !== "P2021") throw e;
    // seasons table missing — fetch without seasons
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partial = await (db.hotels.findUnique as any)({
      where: { id },
      select: { ...SAFE_HOTEL_SCALARS, ...baseInclude, hotelRooms: safeHotelRooms, room_pricing: roomPricingNoSeasons },
    });
    hotel = partial
      ? ({
          ...partial,
          created_by: null,
          updated_by: null,
          hotelRooms: patchRooms(partial.hotelRooms ?? []),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          room_pricing: partial.room_pricing.map((p: any) => ({ ...p, seasons: [] })),
        } as HotelFull)
      : null;
  }
  if (!hotel) return null;
  return hotel;
}

export async function getRoomsByHotel(hotel_id: number) {
  return db.hotel_rooms.findMany({
    where: { hotel_id },
    orderBy: { sort_order: "asc" },
    select: { id: true, name: true },
  });
}

export async function getMealTypes() {
  return db.meal_types.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, covered_meals: true } });
}

export async function createMealType(name: string, coveredMeals: string[]): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.meal_types.create({ data: { name: n, covered_meals: coveredMeals } });
    revalidatePath("/dashboard/hotels/meal-types");
    return { success: true, message: "Meal type added" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateMealType(id: number, name: string, coveredMeals: string[]): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.meal_types.update({ where: { id }, data: { name: n, covered_meals: coveredMeals } });
    revalidatePath("/dashboard/hotels/meal-types");
    return { success: true, message: "Meal type updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteMealType(id: number): Promise<HotelFormState> {
  try {
    await db.meal_types.delete({ where: { id } });
    revalidatePath("/dashboard/hotels/meal-types");
    return { success: true, message: "Meal type deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function getDietTypes() {
  return db.diet_types.findMany({ orderBy: { name: "asc" } });
}

export async function createDietType(name: string): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.diet_types.create({ data: { name: n } });
    revalidatePath("/dashboard/hotels/diet-types");
    return { success: true, message: "Diet type added" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateDietType(id: number, name: string): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.diet_types.update({ where: { id }, data: { name: n } });
    revalidatePath("/dashboard/hotels/diet-types");
    return { success: true, message: "Diet type updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteDietType(id: number): Promise<HotelFormState> {
  try {
    await db.diet_types.delete({ where: { id } });
    revalidatePath("/dashboard/hotels/diet-types");
    return { success: true, message: "Diet type deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: { select: { name: true } } },
  });
}

// ── Create Hotel ──────────────────────────────────────────────────────────

export async function createHotel(
  _prev: HotelFormState,
  formData: FormData,
): Promise<HotelFormState> {
  const { session, actorId, actorName } = await requireSession();

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    thumbnail: formData.get("thumbnail") || undefined,
    category: formData.get("category") || null,
    stay_type: formData.get("stay_type") || null,
    check_in_time: formData.get("check_in_time") || undefined,
    check_out_time: formData.get("check_out_time") || undefined,
    address: formData.get("address") || null,
    city: formData.get("city") || null,
    state: formData.get("state") || null,
    country: formData.get("country") || null,
    pincode: formData.get("pincode") || null,
    business_phone: formData.get("business_phone") || null,
    business_email: formData.get("business_email") || null,
    whatsapp_number: formData.get("whatsapp_number") || null,
    b2b_email: formData.get("b2b_email") || null,
    description: formData.get("description") ?? null,
    meta_title: formData.get("meta_title") || null,
    meta_desc: formData.get("meta_desc") || null,
    is_active: formData.get("is_active") === "true",
    location_id: formData.get("location_id") || undefined,
  };

  const parsed = HotelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const existing = await db.hotels.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already exists", errors: { slug: ["Slug taken"] } };
    }

    const newHotel = await db.$transaction(async (tx) => {
      const hotel = await tx.hotels.create({
        data: { ...parsed.data, created_by: actorId, updated_by: actorId },
        select: { id: true, name: true, slug: true },
      });
      await tx.hotel_image_categories.createMany({
        data: ALL_SYSTEM_HOTEL_CATEGORIES.map((cat) => ({
          hotel_id: hotel.id,
          room_pricing_id: null,
          name: cat.name,
          is_required: cat.is_required,
          is_system: cat.is_system,
          sort_order: cat.sort_order,
        })),
      });
      return hotel;
    });

    await createLog({
      action:    "CREATE",
      entity:    "Hotel",
      entityId:  String(newHotel.id),
      entitySlug: newHotel.slug,
      newData:   { name: newHotel.name },
      userName:  actorName ?? undefined,
      userEmail: session?.user?.email ?? undefined,
    });

    revalidatePath("/dashboard/hotels");
    return { success: true, message: "Hotel created successfully", id: newHotel.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Update Hotel Details ──────────────────────────────────────────────────

export async function updateHotelDetails(
  id: number,
  _prev: HotelFormState,
  formData: FormData,
): Promise<HotelFormState> {
  const { session, actorId, actorName } = await requireSession();

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    thumbnail: formData.get("thumbnail") || undefined,
    category: formData.get("category") || null,
    stay_type: formData.get("stay_type") || null,
    check_in_time: formData.get("check_in_time") || undefined,
    check_out_time: formData.get("check_out_time") || undefined,
    address: formData.get("address") || null,
    city: formData.get("city") || null,
    state: formData.get("state") || null,
    country: formData.get("country") || null,
    pincode: formData.get("pincode") || null,
    business_phone: formData.get("business_phone") || null,
    business_email: formData.get("business_email") || null,
    whatsapp_number: formData.get("whatsapp_number") || null,
    b2b_email: formData.get("b2b_email") || null,
    description: formData.get("description") ?? null,
    meta_title: formData.get("meta_title") || null,
    meta_desc: formData.get("meta_desc") || null,
    is_active: formData.get("is_active") === "true",
    location_id: formData.get("location_id") || undefined,
  };

  const parsed = HotelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const current = await db.hotels.findUnique({
      where: { id },
      select: { thumbnail: true, name: true, slug: true },
    });
    if (current?.thumbnail && current.thumbnail !== (parsed.data.thumbnail ?? "")) {
      await deleteFromR2(current.thumbnail).catch(console.error);
    }

    await db.hotels.update({
      where: { id },
      data: { ...parsed.data, updated_by: actorId },
    });

    await createLog({
      action:    "UPDATE",
      entity:    "Hotel",
      entityId:  String(id),
      entitySlug: current?.slug,
      previousData: { name: current?.name },
      newData:   { name: parsed.data.name },
      userName:  actorName ?? undefined,
      userEmail: session?.user?.email ?? undefined,
    });

    revalidatePath("/dashboard/hotels");
    revalidatePath(`/dashboard/hotels/${id}`);
    return { success: true, message: "Hotel details updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Update Hotel SEO ──────────────────────────────────────────────────────

const SeoSchema = z.object({
  meta_title: z.string().max(60, "Max 60 characters").nullable().optional(),
  meta_desc:  z.string().max(160, "Max 160 characters").nullable().optional(),
});

export async function updateHotelSeo(
  id: number,
  _prev: HotelFormState,
  formData: FormData,
): Promise<HotelFormState> {
  const parsed = SeoSchema.safeParse({
    meta_title: formData.get("meta_title") || null,
    meta_desc:  formData.get("meta_desc")  || null,
  });
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await db.hotels.update({ where: { id }, data: parsed.data });
    revalidatePath("/dashboard/hotels");
    revalidatePath(`/dashboard/hotels/${id}`);
    return { success: true, message: "SEO updated" };
  } catch (e) {
    return actionError(e);
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleHotelActive(id: number, is_active: boolean) {
  const { session, actorId, actorName } = await requireSession();
  await db.hotels.update({ where: { id }, data: { is_active, updated_by: actorId } });
  await createLog({
    action:   "UPDATE",
    entity:   "Hotel",
    entityId: String(id),
    newData:  { is_active },
    metadata: { operation: "toggle_active" },
    userName:  actorName ?? undefined,
    userEmail: session?.user?.email ?? undefined,
  });
  revalidatePath("/dashboard/hotels");
}


// ── Delete Hotel ──────────────────────────────────────────────────────────

export async function deleteHotel(id: number): Promise<HotelFormState> {
  try {
    const hotel = await db.hotels.findUnique({
      where: { id },
      include: {
        images: { select: { url: true, thumbnail: true } },
        hotelRooms: { include: { images: { select: { url: true, thumbnail: true } } } },
        packageBookings: { select: { id: true }, take: 1 },  // ← correct relation name
      },
    });

    if (!hotel) return { success: false, message: "Hotel not found" };
    if (hotel.packageBookings.length > 0) {  // ← update check too
      return {
        success: false,
        message: "Cannot delete — hotel is linked to packages. Remove from packages first.",
      };
    }

    const roomImageKeys = hotel.hotelRooms.flatMap((r) =>
      r.images.flatMap((img) => [img.url, img.thumbnail].filter(Boolean) as string[])
    );
    const r2Keys = [
      ...new Set(
        [
          hotel.thumbnail,
          ...hotel.images.flatMap((img) => [img.url, img.thumbnail]),
          ...roomImageKeys,
        ].filter(Boolean) as string[]
      ),
    ];
    await Promise.all(r2Keys.map((key) => deleteFromR2(key).catch(console.error)));

    const roomIds = hotel.hotelRooms.map((r) => r.id);
    await db.$transaction([
      db.hotel_images.deleteMany({ where: { hotel_id: id } }),
      db.hotel_image_categories.deleteMany({ where: { hotel_id: id } }),
      ...(roomIds.length > 0
        ? [db.hotel_room_images.deleteMany({ where: { room_id: { in: roomIds } } })]
        : []),
      db.hotel_room_pricing.deleteMany({ where: { hotel_id: id } }),
      db.hotel_rooms.deleteMany({ where: { hotel_id: id } }),
      db.hotels.delete({ where: { id } }),
    ]);

    revalidatePath("/dashboard/hotels");
    return { success: true, message: "Hotel deleted" };
  } catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      const field = (err.meta?.field_name as string | undefined) ?? "unknown";
      return { success: false, message: `Cannot delete — hotel is still linked to other records (${field}). Remove those links first.` };
    }
    return actionError(err);
  }
}

// ── Hotel Rooms (hotel_rooms) ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(val: FormDataEntryValue | null): any {
  if (!val || val === "" || val === "null") return null;
  try {
    return JSON.parse(val as string);
  } catch {
    return null;
  }
}

export async function createRoom(hotel_id: number, formData: FormData): Promise<HotelFormState> {
  try {
    const name = (formData.get("name") as string).trim();
    const slug = (formData.get("slug") as string).trim();
    if (!name || !slug) return { success: false, message: "Name and slug are required." };

    const exists = await db.hotel_rooms.findUnique({
      where: { hotel_id_slug: { hotel_id, slug } },
      select: { id: true },
    });
    if (exists) return { success: false, message: "A room with this slug already exists." };

    const count = await db.hotel_rooms.count({ where: { hotel_id } });
    const baseData = {
      hotel_id, name, slug,
      area_sqft:          formData.get("area_sqft") ? Number(formData.get("area_sqft")) : null,
      bed_type:           (formData.get("bed_type")    as string) || null,
      view_type:          (formData.get("view_type")   as string) || null,
      max_occupancy:      Number(formData.get("max_occupancy"))     || 2,
      max_adults:         Number(formData.get("max_adults"))         || 3,
      max_children:       Number(formData.get("max_children"))       || 2,
      extra_bed_capacity: Number(formData.get("extra_bed_capacity")) || 0,
      description:        (formData.get("description") as string) || null,
      amenities:   parseJson(formData.get("amenities")),
      features:    parseJson(formData.get("features")),
      bathroom:    parseJson(formData.get("bathroom")),
      facilities:  parseJson(formData.get("facilities")),
      is_active:   formData.get("is_active") === "true",
      sort_order:  count,
    };
    let room: { id: number };
    try {
      room = await db.hotel_rooms.create({
        data: { ...baseData, bed_count: Number(formData.get("bed_count")) || 1, child_cot_available: formData.get("child_cot_available") === "true" },
        select: { id: true },
      });
    } catch (e2) {
      if ((e2 as Record<string, unknown>).code !== "P2022") throw e2;
      // bed_count / child_cot_available not yet in production DB — omit them
      room = await db.hotel_rooms.create({ data: baseData, select: { id: true } });
    }

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room added", id: room.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateRoom(
  id: number,
  hotel_id: number,
  formData: FormData,
): Promise<HotelFormState> {
  try {
    const name = (formData.get("name") as string).trim();
    if (!name) return { success: false, message: "Name is required." };

    const baseUpdateData = {
      name,
      area_sqft:          formData.get("area_sqft") ? Number(formData.get("area_sqft")) : null,
      bed_type:           (formData.get("bed_type")    as string) || null,
      view_type:          (formData.get("view_type")   as string) || null,
      max_occupancy:      Number(formData.get("max_occupancy"))     || 2,
      max_adults:         Number(formData.get("max_adults"))         || 3,
      max_children:       Number(formData.get("max_children"))       || 2,
      extra_bed_capacity: Number(formData.get("extra_bed_capacity")) || 0,
      description:        (formData.get("description") as string) || null,
      amenities:   parseJson(formData.get("amenities")),
      features:    parseJson(formData.get("features")),
      bathroom:    parseJson(formData.get("bathroom")),
      facilities:  parseJson(formData.get("facilities")),
      is_active:   formData.get("is_active") === "true",
    };
    try {
      await db.hotel_rooms.update({
        where: { id },
        data: { ...baseUpdateData, bed_count: Number(formData.get("bed_count")) || 1, child_cot_available: formData.get("child_cot_available") === "true" },
        select: { id: true },
      });
    } catch (e2) {
      if ((e2 as Record<string, unknown>).code !== "P2022") throw e2;
      // bed_count / child_cot_available not yet in production DB — omit them
      await db.hotel_rooms.update({ where: { id }, data: baseUpdateData, select: { id: true } });
    }

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteRoom(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    const room = await db.hotel_rooms.findUnique({
      where: { id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });
    if (!room) return { success: false, message: "Room not found" };

    const r2Keys = [
      ...new Set(
        room.images.flatMap((img) => [img.url, img.thumbnail].filter(Boolean) as string[])
      ),
    ];
    await Promise.all(r2Keys.map((key) => deleteFromR2(key).catch(console.error)));

    await db.$transaction([
      db.hotel_room_pricing.deleteMany({ where: { room_id: id } }),
      db.hotel_room_images.deleteMany({ where: { room_id: id } }),
      db.hotel_rooms.delete({ where: { id } }),
    ]);

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Room Pricing (hotel_room_pricing) ─────────────────────────────────────

export async function createRoomPricing(
  hotel_id: number,
  formData: FormData,
): Promise<HotelFormState> {
  try {
    const room_id = Number(formData.get("room_id"));
    if (!room_id) return { success: false, message: "Room is required." };
    const price = Number(formData.get("price_per_night"));
    if (!price || price <= 0) return { success: false, message: "Valid base price is required." };

    const validFrom = formData.get("valid_from") as string;
    const validTo = formData.get("valid_to") as string;
    if (validFrom && validTo && new Date(validTo) <= new Date(validFrom)) {
      return { success: false, message: "End date must be after start date." };
    }
    const count = await db.hotel_room_pricing.count({ where: { hotel_id } });

    const plan = await db.hotel_room_pricing.create({
      data: {
        hotel_id,
        room_id,
        plan_name: (formData.get("plan_name") as string) || null,
        meal_type_id: (() => { const v = formData.get("meal_type_id") as string; return v && v !== "none" ? Number(v) : null; })(),
        diet_type_id: formData.get("diet_type_id") ? Number(formData.get("diet_type_id")) : null,
        price_per_night: price,
        original_price: formData.get("original_price") ? Number(formData.get("original_price")) : null,
        extra_bed_rate: formData.get("extra_bed_rate") ? Number(formData.get("extra_bed_rate")) : null,
        margin_percentage: Number(formData.get("margin_percentage")) || 10,
        gst_percentage: Number(formData.get("gst_percentage")) || 18,
        valid_from: validFrom ? new Date(validFrom) : null,
        valid_to: validTo ? new Date(validTo) : null,
        is_active: formData.get("is_active") === "true",
        sort_order: count,
      },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan added", id: plan.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateRoomPricing(
  id: number,
  hotel_id: number,
  formData: FormData,
): Promise<HotelFormState> {
  try {
    const room_id = Number(formData.get("room_id"));
    if (!room_id) return { success: false, message: "Room is required." };
    const price = Number(formData.get("price_per_night"));
    if (!price || price <= 0) return { success: false, message: "Valid base price is required." };

    const validFrom = formData.get("valid_from") as string;
    const validTo = formData.get("valid_to") as string;
    if (validFrom && validTo && new Date(validTo) <= new Date(validFrom)) {
      return { success: false, message: "End date must be after start date." };
    }

    await db.hotel_room_pricing.update({
      where: { id },
      data: {
        room_id,
        plan_name: (formData.get("plan_name") as string) || null,
        meal_type_id: (() => { const v = formData.get("meal_type_id") as string; return v && v !== "none" ? Number(v) : null; })(),
        diet_type_id: formData.get("diet_type_id") ? Number(formData.get("diet_type_id")) : null,
        price_per_night: price,
        original_price: formData.get("original_price") ? Number(formData.get("original_price")) : null,
        extra_bed_rate: formData.get("extra_bed_rate") ? Number(formData.get("extra_bed_rate")) : null,
        margin_percentage: Number(formData.get("margin_percentage")) || 10,
        gst_percentage: Number(formData.get("gst_percentage")) || 18,
        valid_from: validFrom ? new Date(validFrom) : null,
        valid_to: validTo ? new Date(validTo) : null,
        is_active: formData.get("is_active") === "true",
      },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteRoomPricing(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_room_pricing.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Occupancy Prices ──────────────────────────────────────────────────────

export async function upsertOccupancyPrice(
  pricing_id: number,
  hotel_id: number,
  occupancy: number,
  price_per_night: number,
  original_price?: number | null,
): Promise<HotelFormState> {
  try {
    await db.hotel_room_occupancy_prices.upsert({
      where: { pricing_id_occupancy: { pricing_id, occupancy } },
      create: { pricing_id, occupancy, price_per_night, original_price: original_price ?? null },
      update: { price_per_night, original_price: original_price ?? null },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Occupancy price saved" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteOccupancyPrice(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_room_occupancy_prices.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Occupancy price removed" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Pricing Seasons ───────────────────────────────────────────────────────

export type HotelSeasonOccupancyInput = {
  occupancy:       number;
  price_per_night: number;
  original_price?: number | null;
};

export type HotelSeasonInput = {
  season_name:             string;
  valid_from:              string; // YYYY-MM-DD
  valid_to:                string;
  price_per_night:         number;
  weekend_price_per_night?: number | null;
  original_price?:         number | null;
  extra_bed_rate?:         number | null;
  occupancy_prices?:       HotelSeasonOccupancyInput[];
  is_active:               boolean;
};

export async function createPricingSeason(
  pricing_id: number,
  hotel_id:   number,
  data:       HotelSeasonInput,
): Promise<HotelFormState & { id?: number }> {
  try {
    if (!data.season_name?.trim()) return { success: false, message: "Season name is required." };
    if (!data.valid_from || !data.valid_to) return { success: false, message: "Date range is required." };
    if (new Date(data.valid_to) <= new Date(data.valid_from))
      return { success: false, message: "End date must be after start date." };
    if (!data.price_per_night || data.price_per_night <= 0)
      return { success: false, message: "Valid price is required." };

    const count = await db.hotel_room_pricing_season.count({ where: { pricing_id } });
    const season = await db.$transaction(async (tx) => {
      const s = await tx.hotel_room_pricing_season.create({
        data: {
          pricing_id,
          season_name:             data.season_name.trim(),
          valid_from:              new Date(data.valid_from),
          valid_to:                new Date(data.valid_to),
          price_per_night:         data.price_per_night,
          weekend_price_per_night: data.weekend_price_per_night ?? null,
          original_price:          data.original_price  ?? null,
          extra_bed_rate:          data.extra_bed_rate   ?? null,
          is_active:               data.is_active,
          sort_order:              count,
        },
      });
      if (data.occupancy_prices && data.occupancy_prices.length > 0) {
        await tx.hotel_room_pricing_season_occupancy.createMany({
          data: data.occupancy_prices.map(op => ({
            season_id:       s.id,
            occupancy:       op.occupancy,
            price_per_night: op.price_per_night,
            original_price:  op.original_price ?? null,
          })),
        });
      }
      return s;
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Season added", id: season.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updatePricingSeason(
  id:       number,
  hotel_id: number,
  data:     HotelSeasonInput,
): Promise<HotelFormState> {
  try {
    if (!data.season_name?.trim()) return { success: false, message: "Season name is required." };
    if (!data.valid_from || !data.valid_to) return { success: false, message: "Date range is required." };
    if (new Date(data.valid_to) <= new Date(data.valid_from))
      return { success: false, message: "End date must be after start date." };
    if (!data.price_per_night || data.price_per_night <= 0)
      return { success: false, message: "Valid price is required." };

    await db.$transaction(async (tx) => {
      await tx.hotel_room_pricing_season.update({
        where: { id },
        data: {
          season_name:             data.season_name.trim(),
          valid_from:              new Date(data.valid_from),
          valid_to:                new Date(data.valid_to),
          price_per_night:         data.price_per_night,
          weekend_price_per_night: data.weekend_price_per_night ?? null,
          original_price:          data.original_price  ?? null,
          extra_bed_rate:          data.extra_bed_rate   ?? null,
          is_active:               data.is_active,
        },
      });
      await tx.hotel_room_pricing_season_occupancy.deleteMany({ where: { season_id: id } });
      if (data.occupancy_prices && data.occupancy_prices.length > 0) {
        await tx.hotel_room_pricing_season_occupancy.createMany({
          data: data.occupancy_prices.map(op => ({
            season_id:       id,
            occupancy:       op.occupancy,
            price_per_night: op.price_per_night,
            original_price:  op.original_price ?? null,
          })),
        });
      }
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Season updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deletePricingSeason(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_room_pricing_season.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Season deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Combined plan + seasons (create / update in one call) ─────────────────

export type PlanInput = {
  room_id:           number;
  plan_name?:        string | null;
  meal_type_id?:     number | null;
  diet_type_id?:     number | null;
  price_per_night?:  number | null;
  extra_bed_rate?:   number | null;
  margin_percentage: number;
  gst_percentage:    number;
  is_active:         boolean;
  seasons:           HotelSeasonInput[];
};

export async function createRoomPricingWithSeasons(
  hotel_id: number,
  data:     PlanInput,
): Promise<HotelFormState & { id?: number }> {
  try {
    if (!data.room_id) return { success: false, message: "Room is required." };

    const count = await db.hotel_room_pricing.count({ where: { hotel_id } });
    const basePricePerNight = data.price_per_night ?? data.seasons[0]?.price_per_night ?? 0;

    const plan = await db.$transaction(async (tx) => {
      const p = await tx.hotel_room_pricing.create({
        data: {
          hotel_id,
          room_id:           data.room_id,
          plan_name:         data.plan_name         ?? null,
          meal_type_id:      data.meal_type_id      ?? null,
          diet_type_id:      data.diet_type_id      ?? null,
          price_per_night:   basePricePerNight,
          extra_bed_rate:    data.extra_bed_rate     ?? null,
          margin_percentage: data.margin_percentage,
          gst_percentage:    data.gst_percentage,
          is_active:         data.is_active,
          sort_order:        count,
        },
      });
      for (const [i, s] of data.seasons.entries()) {
        const season = await tx.hotel_room_pricing_season.create({
          data: {
            pricing_id:              p.id,
            season_name:             s.season_name.trim(),
            valid_from:              new Date(s.valid_from),
            valid_to:                new Date(s.valid_to),
            price_per_night:         s.price_per_night,
            weekend_price_per_night: s.weekend_price_per_night ?? null,
            original_price:          s.original_price  ?? null,
            extra_bed_rate:          s.extra_bed_rate   ?? null,
            is_active:               s.is_active,
            sort_order:              i,
          },
        });
        if (s.occupancy_prices && s.occupancy_prices.length > 0) {
          await tx.hotel_room_pricing_season_occupancy.createMany({
            data: s.occupancy_prices.map(op => ({
              season_id:       season.id,
              occupancy:       op.occupancy,
              price_per_night: op.price_per_night,
              original_price:  op.original_price ?? null,
            })),
          });
        }
      }
      return p;
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan added", id: plan.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateRoomPricingWithSeasons(
  id:       number,
  hotel_id: number,
  data:     PlanInput,
): Promise<HotelFormState> {
  try {
    if (!data.room_id) return { success: false, message: "Room is required." };

    const basePricePerNight = data.price_per_night ?? data.seasons[0]?.price_per_night ?? 0;

    await db.$transaction(async (tx) => {
      await tx.hotel_room_pricing.update({
        where: { id },
        data: {
          room_id:           data.room_id,
          plan_name:         data.plan_name         ?? null,
          meal_type_id:      data.meal_type_id      ?? null,
          diet_type_id:      data.diet_type_id      ?? null,
          price_per_night:   basePricePerNight,
          extra_bed_rate:    data.extra_bed_rate     ?? null,
          margin_percentage: data.margin_percentage,
          gst_percentage:    data.gst_percentage,
          is_active:         data.is_active,
        },
      });
      // Replace all seasons (cascade deletes season occupancy_prices)
      await tx.hotel_room_pricing_season.deleteMany({ where: { pricing_id: id } });
      for (const [i, s] of data.seasons.entries()) {
        const season = await tx.hotel_room_pricing_season.create({
          data: {
            pricing_id:              id,
            season_name:             s.season_name.trim(),
            valid_from:              new Date(s.valid_from),
            valid_to:                new Date(s.valid_to),
            price_per_night:         s.price_per_night,
            weekend_price_per_night: s.weekend_price_per_night ?? null,
            original_price:          s.original_price  ?? null,
            extra_bed_rate:          s.extra_bed_rate   ?? null,
            is_active:               s.is_active,
            sort_order:              i,
          },
        });
        if (s.occupancy_prices && s.occupancy_prices.length > 0) {
          await tx.hotel_room_pricing_season_occupancy.createMany({
            data: s.occupancy_prices.map(op => ({
              season_id:       season.id,
              occupancy:       op.occupancy,
              price_per_night: op.price_per_night,
              original_price:  op.original_price ?? null,
            })),
          });
        }
      }
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Child Policies ────────────────────────────────────────────────────────

export async function getChildPolicies(hotel_id: number) {
  return db.hotel_child_policies.findMany({
    where: { hotel_id },
    orderBy: { sort_order: "asc" },
  });
}

export async function createChildPolicy(
  hotel_id: number,
  data: {
    age_from: number;
    age_to: number;
    charge_type: string;
    price?: number | null;
    description?: string | null;
    is_active: boolean;
  },
): Promise<HotelFormState> {
  try {
    const count = await db.hotel_child_policies.count({ where: { hotel_id } });
    await db.hotel_child_policies.create({
      data: { hotel_id, ...data, sort_order: count },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Child policy added" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateChildPolicy(
  id: number,
  hotel_id: number,
  data: {
    age_from: number;
    age_to: number;
    charge_type: string;
    price?: number | null;
    description?: string | null;
    is_active: boolean;
  },
): Promise<HotelFormState> {
  try {
    await db.hotel_child_policies.update({ where: { id }, data });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Child policy updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteChildPolicy(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_child_policies.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Child policy deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Room Images (hotel_room_images) ───────────────────────────────────────

export async function createRoomImages(
  room_id: number,
  hotel_id: number,
  images: { url: string; thumbnail?: string; alt?: string }[],
): Promise<HotelFormState> {
  try {
    const existingCount = await db.hotel_room_images.count({ where: { room_id } });
    await db.hotel_room_images.createMany({
      data: images.map((img, i) => ({
        room_id,
        url: img.url,
        thumbnail: img.thumbnail || img.url,
        alt: img.alt || null,
        sort_order: existingCount + i,
        is_primary: existingCount === 0 && i === 0,
      })),
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Images added" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteRoomImage(
  id: number,
  room_id: number,
  hotel_id: number,
  url: string,
  thumbnail?: string,
): Promise<HotelFormState> {
  try {
    const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
    await Promise.all(keys.map((k) => deleteFromR2(k).catch(console.error)));
    await db.hotel_room_images.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Image deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function setPrimaryRoomImage(
  id: number,
  room_id: number,
  hotel_id: number,
): Promise<HotelFormState> {
  try {
    await db.$transaction([
      db.hotel_room_images.updateMany({ where: { room_id }, data: { is_primary: false } }),
      db.hotel_room_images.update({ where: { id }, data: { is_primary: true } }),
    ]);
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Primary image set" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Image Categories ──────────────────────────────────────────────────────

export async function createImageCategory(
  hotel_id: number,
  name: string,
): Promise<HotelFormState> {
  try {
    const count = await db.hotel_image_categories.count({ where: { hotel_id } });
    const created = await db.hotel_image_categories.create({
      data: { hotel_id, name, is_required: false, is_system: false, sort_order: count },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Category added", id: created.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteImageCategory(
  id: number,
  hotel_id: number,
): Promise<HotelFormState> {
  try {
    const category = await db.hotel_image_categories.findUnique({
      where: { id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });
    if (!category) return { success: false, message: "Category not found" };
    if (category.is_required)
      return { success: false, message: "Required categories cannot be deleted" };

    const r2Keys = [
      ...new Set(
        category.images.flatMap((img) => [img.url, img.thumbnail].filter(Boolean) as string[])
      ),
    ];
    await Promise.all(r2Keys.map((key) => deleteFromR2(key).catch(console.error)));

    await db.$transaction([
      db.hotel_images.deleteMany({ where: { category_id: id } }),
      db.hotel_image_categories.delete({ where: { id } }),
    ]);

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Category deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Hotel Images ──────────────────────────────────────────────────────────

export async function addHotelImages(
  hotel_id: number,
  category_id: number,
  images: { url: string; thumbnail?: string; alt?: string }[],
): Promise<HotelFormState> {
  try {
    const existingInCategory = await db.hotel_images.count({ where: { category_id } });
    const totalInHotel = await db.hotel_images.count({ where: { hotel_id } });

    await db.hotel_images.createMany({
      data: images.map((img, i) => ({
        hotel_id,
        category_id,
        url: img.url,
        thumbnail: img.thumbnail || img.url,
        alt: img.alt || null,
        sort_order: existingInCategory + i,
        is_primary: totalInHotel === 0 && i === 0,
      })),
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Images added" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteHotelImage(
  id: number,
  hotel_id: number,
  url: string,
  thumbnail?: string,
): Promise<HotelFormState> {
  try {
    const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
    await Promise.all(keys.map((k) => deleteFromR2(k).catch(console.error)));
    await db.hotel_images.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Image deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function setPrimaryImage(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.$transaction([
      db.hotel_images.updateMany({ where: { hotel_id }, data: { is_primary: false } }),
      db.hotel_images.update({ where: { id }, data: { is_primary: true } }),
    ]);
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Primary image set" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Meal Pricing ───────────────────────────────────────────────────────────

export type HotelMealPricingSeason = {
  id:             number;
  meal_pricing_id: number;
  season_name:    string;
  valid_from:     Date | string;
  valid_to:       Date | string;
  price:          number;
  weekend_price:  number | null;
  is_active:      boolean;
  sort_order:     number;
};

export type HotelMealPricing = {
  id:            number;
  hotel_id:      number;
  meal_type:     string;
  label:         string;
  price:         number;
  weekend_price: number | null;
  veg_price:     number | null;
  non_veg_price: number | null;
  is_active:     boolean;
  sort_order:    number;
  seasons:       HotelMealPricingSeason[];
};

export type MealSeasonInput = {
  season_name:   string;
  valid_from:    string;  // YYYY-MM-DD
  valid_to:      string;
  price:         number;
  weekend_price?: number | null;
  is_active:     boolean;
};

export type MealPricingInput = {
  meal_type:      string;
  label:          string;
  price:          number;
  weekend_price?: number | null;
  veg_price?:     number | null;
  non_veg_price?: number | null;
  is_active:      boolean;
  seasons:        MealSeasonInput[];
};

export async function getMealPricings(hotel_id: number): Promise<HotelMealPricing[]> {
  if (!Number.isInteger(hotel_id) || hotel_id <= 0) return [];
  try {
    const rows = await db.hotel_meal_pricing.findMany({
      where: { hotel_id },
      orderBy: { sort_order: "asc" },
      include: { seasons: { orderBy: { sort_order: "asc" } } },
    });
    return rows.map((m) => ({
      ...m,
      price:         Number(m.price),
      weekend_price: m.weekend_price ? Number(m.weekend_price) : null,
      veg_price:     m.veg_price ? Number(m.veg_price) : null,
      non_veg_price: m.non_veg_price ? Number(m.non_veg_price) : null,
      seasons: m.seasons.map((s) => ({
        ...s,
        price:         Number(s.price),
        weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
      })),
    }));
  } catch {
    return [];
  }
}

export async function createMealPricing(
  hotel_id: number,
  data: MealPricingInput,
): Promise<HotelFormState & { id?: number }> {
  try {
    if (!data.label?.trim()) return { success: false, message: "Meal name is required." };
    if (!data.price || data.price <= 0) return { success: false, message: "Valid price is required." };

    const count = await db.hotel_meal_pricing.count({ where: { hotel_id } });
    const meal = await db.$transaction(async (tx) => {
      const m = await tx.hotel_meal_pricing.create({
        data: {
          hotel_id,
          meal_type:     data.meal_type,
          label:         data.label.trim(),
          price:         data.price,
          weekend_price: data.weekend_price ?? null,
          veg_price:     data.veg_price ?? null,
          non_veg_price: data.non_veg_price ?? null,
          is_active:     data.is_active,
          sort_order:    count,
        },
      });
      for (const [i, s] of data.seasons.entries()) {
        await tx.hotel_meal_pricing_season.create({
          data: {
            meal_pricing_id: m.id,
            season_name:     s.season_name.trim(),
            valid_from:      new Date(s.valid_from),
            valid_to:        new Date(s.valid_to),
            price:           s.price,
            weekend_price:   s.weekend_price ?? null,
            is_active:       s.is_active,
            sort_order:      i,
          },
        });
      }
      return m;
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Meal pricing added", id: meal.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateMealPricing(
  id: number,
  hotel_id: number,
  data: MealPricingInput,
): Promise<HotelFormState> {
  try {
    if (!data.label?.trim()) return { success: false, message: "Meal name is required." };
    if (!data.price || data.price <= 0) return { success: false, message: "Valid price is required." };

    await db.$transaction(async (tx) => {
      await tx.hotel_meal_pricing.update({
        where: { id },
        data: {
          meal_type:     data.meal_type,
          label:         data.label.trim(),
          price:         data.price,
          weekend_price: data.weekend_price ?? null,
          veg_price:     data.veg_price ?? null,
          non_veg_price: data.non_veg_price ?? null,
          is_active:     data.is_active,
        },
      });
      // Replace all seasons
      await tx.hotel_meal_pricing_season.deleteMany({ where: { meal_pricing_id: id } });
      for (const [i, s] of data.seasons.entries()) {
        await tx.hotel_meal_pricing_season.create({
          data: {
            meal_pricing_id: id,
            season_name:     s.season_name.trim(),
            valid_from:      new Date(s.valid_from),
            valid_to:        new Date(s.valid_to),
            price:           s.price,
            weekend_price:   s.weekend_price ?? null,
            is_active:       s.is_active,
            sort_order:      i,
          },
        });
      }
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Meal pricing updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteMealPricing(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_meal_pricing.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Meal pricing deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Hotel Margin & GST (hotel-level, applied to all variants) ─────────────

export async function updateHotelMarginGst(
  hotel_id: number,
  margin_percentage: number,
  gst_percentage: number,
): Promise<HotelFormState> {
  try {
    if (margin_percentage < 0 || margin_percentage > 100)
      return { success: false, message: "Margin must be between 0 and 100." };
    if (gst_percentage < 0 || gst_percentage > 100)
      return { success: false, message: "GST must be between 0 and 100." };

    await db.hotels.update({
      where: { id: hotel_id },
      data: { margin_percentage, gst_percentage },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Margin & GST updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Add-ons (hotel_addons) ────────────────────────────────────────────────

export type HotelAddonSeason = {
  id:            number;
  addon_id:      number;
  season_name:   string;
  valid_from:    Date | string;
  valid_to:      Date | string;
  price:         number;
  weekend_price: number | null;
  is_active:     boolean;
  sort_order:    number;
};

export type HotelAddon = {
  id:            number;
  hotel_id:      number;
  label:         string;
  description:   string | null;
  charge_type:   string; // PER_PERSON | PER_ROOM | PER_BOOKING
  price:         number;
  weekend_price: number | null;
  is_active:     boolean;
  sort_order:    number;
  seasons:       HotelAddonSeason[];
};

export type AddonSeasonInput = {
  season_name:    string;
  valid_from:     string; // YYYY-MM-DD
  valid_to:       string;
  price:          number;
  weekend_price?: number | null;
  is_active:      boolean;
};

export type AddonInput = {
  label:          string;
  description?:   string | null;
  charge_type:    string;
  price:          number;
  weekend_price?: number | null;
  is_active:      boolean;
  seasons:        AddonSeasonInput[];
};

export async function getHotelAddons(hotel_id: number): Promise<HotelAddon[]> {
  if (!Number.isInteger(hotel_id) || hotel_id <= 0) return [];
  try {
    const rows = await db.hotel_addons.findMany({
      where: { hotel_id },
      orderBy: { sort_order: "asc" },
      include: { seasons: { orderBy: { sort_order: "asc" } } },
    });
    return rows.map((a) => ({
      ...a,
      price:         Number(a.price),
      weekend_price: a.weekend_price ? Number(a.weekend_price) : null,
      seasons: a.seasons.map((s) => ({
        ...s,
        price:         Number(s.price),
        weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
      })),
    }));
  } catch {
    return [];
  }
}

export async function createAddon(
  hotel_id: number,
  data: AddonInput,
): Promise<HotelFormState & { id?: number }> {
  try {
    if (!data.label?.trim()) return { success: false, message: "Label is required." };
    if (!data.price || data.price <= 0) return { success: false, message: "Valid price is required." };
    if (!["PER_PERSON", "PER_ROOM", "PER_BOOKING"].includes(data.charge_type))
      return { success: false, message: "Invalid charge type." };

    const count = await db.hotel_addons.count({ where: { hotel_id } });
    const addon = await db.$transaction(async (tx) => {
      const a = await tx.hotel_addons.create({
        data: {
          hotel_id,
          label:         data.label.trim(),
          description:   data.description?.trim() || null,
          charge_type:   data.charge_type,
          price:         data.price,
          weekend_price: data.weekend_price ?? null,
          is_active:     data.is_active,
          sort_order:    count,
        },
      });
      for (const [i, s] of data.seasons.entries()) {
        await tx.hotel_addon_seasons.create({
          data: {
            addon_id:      a.id,
            season_name:   s.season_name.trim(),
            valid_from:    new Date(s.valid_from),
            valid_to:      new Date(s.valid_to),
            price:         s.price,
            weekend_price: s.weekend_price ?? null,
            is_active:     s.is_active,
            sort_order:    i,
          },
        });
      }
      return a;
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Add-on created", id: addon.id };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function updateAddon(
  id: number,
  hotel_id: number,
  data: AddonInput,
): Promise<HotelFormState> {
  try {
    if (!data.label?.trim()) return { success: false, message: "Label is required." };
    if (!data.price || data.price <= 0) return { success: false, message: "Valid price is required." };
    if (!["PER_PERSON", "PER_ROOM", "PER_BOOKING"].includes(data.charge_type))
      return { success: false, message: "Invalid charge type." };

    await db.$transaction(async (tx) => {
      await tx.hotel_addons.update({
        where: { id },
        data: {
          label:         data.label.trim(),
          description:   data.description?.trim() || null,
          charge_type:   data.charge_type,
          price:         data.price,
          weekend_price: data.weekend_price ?? null,
          is_active:     data.is_active,
        },
      });
      await tx.hotel_addon_seasons.deleteMany({ where: { addon_id: id } });
      for (const [i, s] of data.seasons.entries()) {
        await tx.hotel_addon_seasons.create({
          data: {
            addon_id:      id,
            season_name:   s.season_name.trim(),
            valid_from:    new Date(s.valid_from),
            valid_to:      new Date(s.valid_to),
            price:         s.price,
            weekend_price: s.weekend_price ?? null,
            is_active:     s.is_active,
            sort_order:    i,
          },
        });
      }
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Add-on updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

export async function deleteAddon(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_addons.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Add-on deleted" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}
