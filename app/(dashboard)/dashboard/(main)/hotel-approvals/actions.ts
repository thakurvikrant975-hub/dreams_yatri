"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";
import { APPROVAL_SECTIONS, type ApprovalSectionKey } from "./approval-checklist";

// ── Shared ────────────────────────────────────────────────────────────────────

export type ApprovalStatusFilter = "pending" | "approved" | "changes" | "all";

const num = (v: unknown) => Number(v);
const numOrNull = (v: unknown) => (v != null ? Number(v) : null);

const STATUS_WHERE: Record<Exclude<ApprovalStatusFilter, "all">, Prisma.hotelsWhereInput> = {
  pending: { approval_status: "PENDING" },
  approved: { approval_status: "APPROVED" },
  changes: { approval_status: "CHANGES_REQUESTED" },
};

async function requireSession() {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");
  return session;
}

/** Team-member display names for a set of ids, for "reviewed by" labels. */
async function reviewerNames(ids: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return {};
  const members = await db.teamMember.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return Object.fromEntries(members.map((m) => [m.id, m.name]));
}

// ── List ──────────────────────────────────────────────────────────────────────

export type GetHotelApprovalsParams = {
  page: number;
  limit: number;
  search: string;
  status: ApprovalStatusFilter;
  destination: number | "all";
};

export type HotelApprovalListItem = {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  category: string | null;
  is_active: boolean;
  updated_at: Date;
  destination: { id: number; name: string } | null;
  owner: { name: string } | null;
  approval_status: string;
  approval_notes: string | null;
  approval_flags: string[];
  approval_reviewed_at: Date | null;
  approval_reviewed_by_id: string | null;
  // Checklist inputs — kept flat so the client can run buildChecklist() itself.
  description: string | null;
  destination_id: number | null;
  address: string | null;
  pincode: string | null;
  business_phone: string | null;
  business_email: string | null;
  b2b_email: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  meta_title: string | null;
  meta_desc: string | null;
  margin_percentage: number;
  gst_percentage: number;
  imageCount: number;
  childPolicyCount: number;
  rooms: { name: string; pricingCount: number; imageCount: number }[];
};

export async function getHotelApprovals(params: GetHotelApprovalsParams): Promise<{
  hotels: HotelApprovalListItem[];
  reviewers: Record<string, string>;
  totalCount: number;
  stats: { pending: number; approved: number; changes: number; total: number };
}> {
  await requireSession();

  const where: Prisma.hotelsWhereInput = {
    ...(params.status === "all" ? {} : STATUS_WHERE[params.status]),
    ...(params.destination !== "all" ? { destination_id: params.destination } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { city: { contains: params.search, mode: "insensitive" } },
            { state: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, totalCount, pending, approved, changes, total] = await Promise.all([
    db.hotels.findMany({
      where,
      // Unreviewed first, then the ones sitting untouched the longest.
      orderBy: [{ approval_reviewed_at: { sort: "asc", nulls: "first" } }, { updated_at: "desc" }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, name: true, slug: true, thumbnail: true, city: true, state: true, country: true,
        category: true, is_active: true, updated_at: true, description: true, destination_id: true,
        address: true, pincode: true, business_phone: true, business_email: true, b2b_email: true,
        check_in_time: true, check_out_time: true, meta_title: true, meta_desc: true,
        margin_percentage: true, gst_percentage: true,
        approval_status: true, approval_notes: true, approval_flags: true,
        approval_reviewed_at: true, approval_reviewed_by_id: true,
        destination: { select: { id: true, name: true } },
        owner: { select: { name: true } },
        _count: { select: { images: true, childPolicies: true } },
        hotelRooms: {
          where: { is_active: true },
          orderBy: { sort_order: "asc" },
          select: {
            name: true,
            _count: { select: { images: true } },
            pricing: { where: { is_active: true }, select: { id: true } },
          },
        },
      },
    }),
    db.hotels.count({ where }),
    db.hotels.count({ where: { approval_status: "PENDING" } }),
    db.hotels.count({ where: { approval_status: "APPROVED" } }),
    db.hotels.count({ where: { approval_status: "CHANGES_REQUESTED" } }),
    db.hotels.count(),
  ]);

  const hotels: HotelApprovalListItem[] = rows.map(({ _count, hotelRooms, ...h }) => ({
    ...h,
    margin_percentage: num(h.margin_percentage),
    gst_percentage: num(h.gst_percentage),
    imageCount: _count.images,
    childPolicyCount: _count.childPolicies,
    rooms: hotelRooms.map((r) => ({ name: r.name, pricingCount: r.pricing.length, imageCount: r._count.images })),
  }));

  return {
    hotels,
    reviewers: await reviewerNames(hotels.map((h) => h.approval_reviewed_by_id)),
    totalCount,
    stats: { pending, approved, changes, total },
  };
}

export async function getDestinationsForApprovalFilter() {
  return db.destinations.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getHotelApprovalDetail(hotelId: number) {
  await requireSession();

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: {
      id: true, name: true, slug: true, description: true, thumbnail: true,
      category: true, stay_type: true, is_active: true,
      meta_title: true, meta_desc: true,
      destination_id: true, address: true, city: true, state: true, country: true, pincode: true,
      latitude: true, longitude: true, landmark: true,
      business_phone: true, business_email: true, whatsapp_number: true, b2b_email: true,
      check_in_time: true, check_out_time: true,
      margin_percentage: true, gst_percentage: true,
      created_at: true, updated_at: true, created_by: true, updated_by: true,
      listing_status: true, owner_id: true,
      approval_status: true, approval_notes: true, approval_flags: true,
      approval_reviewed_at: true, approval_reviewed_by_id: true,

      destination: { select: { id: true, name: true } },
      location: { select: { name: true, state: { select: { name: true } }, country: { select: { name: true } } } },
      owner: { select: { name: true, email: true, phone: true, phone_cc: true, businessName: true } },

      hotelRooms: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, name: true, room_type: true, bed_type: true, bed_count: true, view_type: true,
          area_sqft: true, area_unit: true, num_rooms: true, is_bookable: true, description: true,
          max_occupancy: true, max_adults: true, max_children: true,
          base_adults: true, base_children: true, extra_bed_capacity: true, child_cot_available: true,
          amenities: true,
          images: { orderBy: { sort_order: "asc" }, select: { id: true, url: true, thumbnail: true } },
          pricing: {
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
            select: {
              id: true, plan_name: true, price_per_night: true, original_price: true,
              weekend_price_per_night: true, extra_bed_rate: true, extra_child_rate: true,
              margin_percentage: true, gst_percentage: true, valid_from: true, valid_to: true,
              cancellation_policy: true, notes: true,
              meal_type: { select: { name: true } },
              diet_type: { select: { name: true } },
              occupancy_prices: { orderBy: { occupancy: "asc" }, select: { occupancy: true, price_per_night: true, original_price: true } },
              seasons: {
                where: { is_active: true },
                orderBy: { valid_from: "asc" },
                select: {
                  id: true, season_name: true, valid_from: true, valid_to: true,
                  price_per_night: true, weekend_price_per_night: true, original_price: true,
                  extra_bed_rate: true, extra_child_rate: true,
                },
              },
            },
          },
        },
      },

      childPolicies: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { id: true, age_from: true, age_to: true, charge_type: true, price: true, description: true },
      },

      meal_pricing: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { id: true, meal_type: true, label: true, price: true, weekend_price: true, veg_price: true, non_veg_price: true },
      },

      addons: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { id: true, label: true, description: true, charge_type: true, price: true, weekend_price: true },
      },

      image_categories: {
        orderBy: { sort_order: "asc" },
        select: {
          id: true, name: true, is_required: true,
          images: { orderBy: { sort_order: "asc" }, select: { id: true, url: true, thumbnail: true, is_primary: true, alt: true } },
        },
      },

      _count: { select: { images: true, childPolicies: true } },
    },
  });
  if (!hotel) return null;

  const {
    _count, image_categories, hotelRooms, childPolicies, meal_pricing, addons, ...h
  } = hotel;

  // Prisma.Decimal can't cross the RSC boundary — flatten everything to numbers
  // here so the page stays a thin shell over this action.
  return {
    ...h,
    latitude: numOrNull(h.latitude),
    longitude: numOrNull(h.longitude),
    margin_percentage: num(h.margin_percentage),
    gst_percentage: num(h.gst_percentage),
    imageCount: _count.images,
    childPolicyCount: _count.childPolicies,
    reviewerName: h.approval_reviewed_by_id ? (await reviewerNames([h.approval_reviewed_by_id]))[h.approval_reviewed_by_id] ?? null : null,
    rooms: hotelRooms.map((r) => ({
      ...r,
      amenities: (r.amenities ?? null) as unknown,
      pricing: r.pricing.map((p) => ({
        ...p,
        price_per_night: num(p.price_per_night),
        original_price: numOrNull(p.original_price),
        weekend_price_per_night: numOrNull(p.weekend_price_per_night),
        extra_bed_rate: numOrNull(p.extra_bed_rate),
        extra_child_rate: numOrNull(p.extra_child_rate),
        margin_percentage: num(p.margin_percentage),
        gst_percentage: num(p.gst_percentage),
        occupancy_prices: p.occupancy_prices.map((o) => ({
          ...o,
          price_per_night: num(o.price_per_night),
          original_price: numOrNull(o.original_price),
        })),
        seasons: p.seasons.map((s) => ({
          ...s,
          price_per_night: num(s.price_per_night),
          weekend_price_per_night: numOrNull(s.weekend_price_per_night),
          original_price: numOrNull(s.original_price),
          extra_bed_rate: numOrNull(s.extra_bed_rate),
          extra_child_rate: numOrNull(s.extra_child_rate),
        })),
      })),
    })),
    childPolicies: childPolicies.map((c) => ({ ...c, price: numOrNull(c.price) })),
    mealPricing: meal_pricing.map((m) => ({
      ...m,
      price: num(m.price),
      weekend_price: numOrNull(m.weekend_price),
      veg_price: numOrNull(m.veg_price),
      non_veg_price: numOrNull(m.non_veg_price),
    })),
    addons: addons.map((a) => ({ ...a, price: num(a.price), weekend_price: numOrNull(a.weekend_price) })),
    imageCategories: image_categories,
  };
}

export type HotelApprovalDetail = NonNullable<Awaited<ReturnType<typeof getHotelApprovalDetail>>>;

/** Past approval decisions on this hotel, newest first. */
export async function getHotelApprovalHistory(hotelId: number) {
  await requireSession();

  const logs = await db.activityLog.findMany({
    where: { entity: "Hotel", entityId: String(hotelId) },
    orderBy: { actionAt: "desc" },
    take: 50,
    select: { id: true, description: true, userName: true, userEmail: true, metadata: true, actionAt: true },
  });

  return logs
    .filter((l) => {
      const op = (l.metadata as { operation?: string } | null)?.operation;
      return op === "approve_hotel" || op === "request_hotel_changes" || op === "reopen_hotel_approval";
    })
    .map((l) => ({
      id: l.id,
      operation: (l.metadata as { operation?: string }).operation as string,
      description: l.description,
      by: l.userName ?? l.userEmail ?? "Unknown",
      at: l.actionAt,
      notes: (l.metadata as { notes?: string }).notes ?? null,
      flags: ((l.metadata as { flags?: string[] }).flags ?? []) as string[],
    }));
}

// ── Decisions ─────────────────────────────────────────────────────────────────

export type ApprovalDecisionResult = { ok: boolean; error?: string };

const VALID_SECTIONS = new Set<string>(APPROVAL_SECTIONS.map((s) => s.key));

function sanitizeFlags(flags: string[]): ApprovalSectionKey[] {
  return [...new Set(flags.filter((f) => VALID_SECTIONS.has(f)))] as ApprovalSectionKey[];
}

function revalidate(hotelId: number) {
  revalidatePath("/dashboard/hotel-approvals");
  revalidatePath(`/dashboard/hotel-approvals/${hotelId}`);
  revalidatePath("/dashboard/hotels");
}

export async function approveHotel(hotelId: number, note: string): Promise<ApprovalDecisionResult> {
  const session = await requireSession();

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, slug: true, approval_status: true },
  });
  if (!hotel) return { ok: false, error: "Hotel not found." };
  if (hotel.approval_status === "APPROVED") return { ok: false, error: "This hotel is already approved." };

  const trimmed = note.trim().slice(0, 1000);

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      approval_status: "APPROVED",
      approval_notes: trimmed || null,
      approval_flags: [],
      approval_reviewed_at: new Date(),
      approval_reviewed_by_id: session.user.id,
    },
  });

  await createLog({
    action: "UPDATE",
    entity: "Hotel",
    entityId: String(hotelId),
    entitySlug: hotel.slug,
    description: `${session.user.name ?? session.user.email ?? "A manager"} approved the hotel "${hotel.name}"${trimmed ? `: ${trimmed}` : ""}`,
    metadata: { operation: "approve_hotel", notes: trimmed, flags: [] },
    previousData: { approval_status: hotel.approval_status },
    newData: { approval_status: "APPROVED" },
  });

  revalidate(hotelId);
  return { ok: true };
}

export async function requestHotelChanges(
  hotelId: number,
  notes: string,
  flags: string[],
): Promise<ApprovalDecisionResult> {
  const session = await requireSession();

  const trimmed = notes.trim();
  if (trimmed.length < 10) {
    return { ok: false, error: "Please describe what's missing (at least 10 characters) so the team can fix it." };
  }

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, slug: true, approval_status: true },
  });
  if (!hotel) return { ok: false, error: "Hotel not found." };

  const cleanFlags = sanitizeFlags(flags);

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      approval_status: "CHANGES_REQUESTED",
      approval_notes: trimmed.slice(0, 1000),
      approval_flags: cleanFlags,
      approval_reviewed_at: new Date(),
      approval_reviewed_by_id: session.user.id,
    },
  });

  await createLog({
    action: "UPDATE",
    entity: "Hotel",
    entityId: String(hotelId),
    entitySlug: hotel.slug,
    description: `${session.user.name ?? session.user.email ?? "A manager"} requested changes on "${hotel.name}": ${trimmed}`,
    status: "REJECTED",
    metadata: { operation: "request_hotel_changes", notes: trimmed, flags: cleanFlags },
    previousData: { approval_status: hotel.approval_status },
    newData: { approval_status: "CHANGES_REQUESTED", approval_flags: cleanFlags },
  });

  revalidate(hotelId);
  return { ok: true };
}

/** Puts a decided hotel back in the queue — e.g. after the content was reworked. */
export async function reopenHotelApproval(hotelId: number): Promise<ApprovalDecisionResult> {
  const session = await requireSession();

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, slug: true, approval_status: true },
  });
  if (!hotel) return { ok: false, error: "Hotel not found." };
  if (hotel.approval_status === "PENDING") return { ok: false, error: "This hotel is already awaiting review." };

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      approval_status: "PENDING",
      approval_flags: [],
      approval_reviewed_at: null,
      approval_reviewed_by_id: null,
    },
  });

  await createLog({
    action: "UPDATE",
    entity: "Hotel",
    entityId: String(hotelId),
    entitySlug: hotel.slug,
    description: `${session.user.name ?? session.user.email ?? "A manager"} re-opened "${hotel.name}" for review`,
    metadata: { operation: "reopen_hotel_approval", notes: "", flags: [] },
    previousData: { approval_status: hotel.approval_status },
    newData: { approval_status: "PENDING" },
  });

  revalidate(hotelId);
  return { ok: true };
}
