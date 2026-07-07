"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";

// ── List ──────────────────────────────────────────────────────────────────────

export type SubmissionStatusFilter = "pending" | "approved" | "rejected" | "all";

export type GetSubmissionsParams = {
  page: number;
  limit: number;
  search: string;
  status: SubmissionStatusFilter;
};

export type SubmissionListItem = {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  thumbnail: string | null;
  property_category: string | null;
  property_sub_type: string | null;
  listing_status: string;
  submitted_at: Date | null;
  owner: { name: string; email: string } | null;
  _count: { images: number };
};

export async function getSubmissions(params: GetSubmissionsParams): Promise<{
  hotels: SubmissionListItem[];
  totalCount: number;
  stats: { pending: number; approved: number; rejected: number; total: number };
}> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const statusWhere: Prisma.hotelsWhereInput =
    params.status === "pending" ? { listing_status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }
    : params.status === "approved" ? { listing_status: { in: ["APPROVED", "LIVE"] } }
    : params.status === "rejected" ? { listing_status: "REJECTED" }
    : { listing_status: { not: "DRAFT" } };

  const searchWhere: Prisma.hotelsWhereInput = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: "insensitive" } },
          { city: { contains: params.search, mode: "insensitive" } },
          { owner: { name: { contains: params.search, mode: "insensitive" } } },
          { owner: { email: { contains: params.search, mode: "insensitive" } } },
        ],
      }
    : {};

  const where: Prisma.hotelsWhereInput = { ...statusWhere, ...searchWhere, owner_id: { not: null } };

  const [hotels, totalCount, pending, approved, rejected, total] = await Promise.all([
    db.hotels.findMany({
      where,
      orderBy: [{ submitted_at: "desc" }, { id: "desc" }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, name: true, slug: true, city: true, state: true, thumbnail: true,
        property_category: true, property_sub_type: true, listing_status: true, submitted_at: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { images: true } },
      },
    }),
    db.hotels.count({ where }),
    db.hotels.count({ where: { listing_status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, owner_id: { not: null } } }),
    db.hotels.count({ where: { listing_status: { in: ["APPROVED", "LIVE"] }, owner_id: { not: null } } }),
    db.hotels.count({ where: { listing_status: "REJECTED", owner_id: { not: null } } }),
    db.hotels.count({ where: { listing_status: { not: "DRAFT" }, owner_id: { not: null } } }),
  ]);

  return { hotels, totalCount, stats: { pending, approved, rejected, total } };
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getSubmissionDetail(hotelId: number) {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: {
      id: true, name: true, slug: true, listing_status: true, wizard_step: true,
      submitted_at: true, approved_at: true, approved_by_id: true, rejection_reason: true, created_at: true,
      owner: { select: { id: true, name: true, email: true, phone: true, phone_cc: true, businessName: true } },

      // Basic Info
      property_category: true, property_sub_type: true, star_rating: true,
      year_built: true, booking_since_year: true, hosted_as: true, host_lives_at_property: true,
      contact_email: true, contact_mobile_cc: true, contact_mobile: true,
      contact_whatsapp: true, contact_landline: true,

      // Location
      address: true, city: true, state: true, country: true, pincode: true, landmark: true,
      latitude: true, longitude: true,

      // Amenities
      property_amenities: true,

      // Homestay Rooms & Spaces
      hs_bedrooms: true, hs_bathrooms: true, hs_has_kitchen: true,
      hs_bedroom_details: true, hs_bathroom_details: true, hs_kitchen_details: true, hs_space_items: true,

      // Meals, Pricing & Availability (homestay)
      prop_num_units: true, prop_meal_option: true, prop_base_occupancy: true,
      prop_max_adults: true, prop_max_children: true, prop_max_occupancy: true,
      prop_base_rate: true, prop_extra_adult: true, prop_child_rate: true,

      // Policies
      check_in_time: true, check_out_time: true, has_check_in_end_time: true, check_in_end_time: true,
      cancellation_policy: true, custom_policy: true,
      allow_unmarried_couples: true, show_couple_tag: true, allow_guests_below_18: true,
      allow_male_only_groups: true, smoking_allowed: true, parties_events_allowed: true,
      wheelchair_accessible: true, allow_outside_visitors: true, pets_allowed: true, pets_on_property: true,

      // Finance & Legal
      bank_account_number: true, bank_ifsc_code: true, bank_name: true,
      gstin_number: true, pan_number: true, business_type: true, msme_number: true,
      property_documents: true,

      // Rooms (hotel-type)
      hotelRooms: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, name: true, bed_type: true, area_sqft: true,
          max_adults: true, max_children: true, max_occupancy: true,
          pricing: {
            where: { is_active: true },
            select: { id: true, plan_name: true, price_per_night: true, gst_percentage: true },
          },
        },
      },

      // Photos
      images: {
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        select: { id: true, url: true, tags: true, is_primary: true },
      },
    },
  });
  if (!hotel) return null;

  const approvedBy = hotel.approved_by_id
    ? await db.teamMember.findUnique({ where: { id: hotel.approved_by_id }, select: { name: true } })
    : null;

  return { ...hotel, approvedByName: approvedBy?.name ?? null };
}

export type SubmissionDetail = NonNullable<Awaited<ReturnType<typeof getSubmissionDetail>>>;

// ── Review lifecycle actions ─────────────────────────────────────────────────

/** Claims a SUBMITTED property for review the first time an admin opens it. */
export async function startReview(hotelId: number): Promise<void> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  await db.hotels.updateMany({
    where: { id: hotelId, listing_status: "SUBMITTED" },
    data: { listing_status: "UNDER_REVIEW" },
  });
}

export type DecisionResult = { ok: boolean; error?: string };

export async function approveSubmission(hotelId: number): Promise<DecisionResult> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, slug: true, listing_status: true },
  });
  if (!hotel) return { ok: false, error: "Property not found." };
  if (hotel.listing_status !== "SUBMITTED" && hotel.listing_status !== "UNDER_REVIEW") {
    return { ok: false, error: `This property is currently "${hotel.listing_status}" and can't be approved from here.` };
  }

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      listing_status: "LIVE",
      approved_at: new Date(),
      approved_by_id: session.user.id,
      rejection_reason: null,
    },
  });

  await createLog({
    action: "UPDATE",
    entity: "hotel_submission",
    entityId: String(hotelId),
    entitySlug: hotel.slug,
    description: `${session.user.name ?? session.user.email ?? "An admin"} approved "${hotel.name}" — now live`,
    metadata: { operation: "approve_submission" },
    previousData: { listing_status: hotel.listing_status },
    newData: { listing_status: "LIVE" },
  });

  revalidatePath("/dashboard/property-submissions");
  revalidatePath(`/dashboard/property-submissions/${hotelId}`);
  return { ok: true };
}

export async function rejectSubmission(hotelId: number, reason: string): Promise<DecisionResult> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { ok: false, error: "Please provide a more detailed rejection reason (at least 10 characters)." };
  }

  const hotel = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, slug: true, listing_status: true },
  });
  if (!hotel) return { ok: false, error: "Property not found." };
  if (hotel.listing_status !== "SUBMITTED" && hotel.listing_status !== "UNDER_REVIEW") {
    return { ok: false, error: `This property is currently "${hotel.listing_status}" and can't be rejected from here.` };
  }

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      listing_status: "REJECTED",
      rejection_reason: trimmed,
    },
  });

  await createLog({
    action: "UPDATE",
    entity: "hotel_submission",
    entityId: String(hotelId),
    entitySlug: hotel.slug,
    description: `${session.user.name ?? session.user.email ?? "An admin"} rejected "${hotel.name}": ${trimmed}`,
    status: "REJECTED",
    metadata: { operation: "reject_submission" },
    previousData: { listing_status: hotel.listing_status },
    newData: { listing_status: "REJECTED", rejection_reason: trimmed },
  });

  revalidatePath("/dashboard/property-submissions");
  revalidatePath(`/dashboard/property-submissions/${hotelId}`);
  return { ok: true };
}
