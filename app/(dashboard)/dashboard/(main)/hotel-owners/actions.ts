"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";

// ── List ──────────────────────────────────────────────────────────────────────

export type OwnerVerifiedFilter = "all" | "verified" | "unverified";

export type GetHotelOwnersParams = {
  page: number;
  limit: number;
  search: string;
  verified: OwnerVerifiedFilter;
};

export type HotelOwnerListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phone_cc: string | null;
  businessName: string | null;
  property_count: number;
  email_verified: boolean;
  status: string;
  verifiedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  _count: { hotels: number };
};

export async function getHotelOwners(params: GetHotelOwnersParams): Promise<{
  owners: HotelOwnerListItem[];
  totalCount: number;
  stats: { total: number; verified: number; unverified: number; activeListings: number };
}> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const verifiedWhere: Prisma.HotelOwnerWhereInput =
    params.verified === "verified" ? { verifiedAt: { not: null } }
    : params.verified === "unverified" ? { verifiedAt: null }
    : {};

  const searchWhere: Prisma.HotelOwnerWhereInput = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } },
          { businessName: { contains: params.search, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.HotelOwnerWhereInput = { ...verifiedWhere, ...searchWhere };

  const [owners, totalCount, total, verified, unverified, activeListings] = await Promise.all([
    db.hotelOwner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, name: true, email: true, phone: true, phone_cc: true, businessName: true,
        property_count: true, email_verified: true, status: true, verifiedAt: true,
        createdAt: true, lastLoginAt: true,
        _count: { select: { hotels: true } },
      },
    }),
    db.hotelOwner.count({ where }),
    db.hotelOwner.count(),
    db.hotelOwner.count({ where: { verifiedAt: { not: null } } }),
    db.hotelOwner.count({ where: { verifiedAt: null } }),
    db.hotels.count({ where: { listing_status: "LIVE" } }),
  ]);

  return { owners, totalCount, stats: { total, verified, unverified, activeListings } };
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getHotelOwnerDetail(ownerId: string) {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const owner = await db.hotelOwner.findUnique({
    where: { id: ownerId },
    select: {
      id: true, name: true, email: true, phone: true, phone_cc: true, whatsapp: true, whatsapp_cc: true,
      businessName: true, business_description: true, founded_year: true, gender: true, languages: true,
      logo_url: true, property_count: true, status: true,
      email_verified: true, verifiedAt: true, verifiedById: true, createdAt: true, lastLoginAt: true,
    },
  });
  if (!owner) return null;

  const verifiedByMember = owner.verifiedById
    ? await db.teamMember.findUnique({ where: { id: owner.verifiedById }, select: { name: true } })
    : null;

  const hotels = await db.hotels.findMany({
    where: { owner_id: ownerId },
    orderBy: { created_at: "desc" },
    select: {
      id: true, name: true, slug: true, listing_status: true, city: true, state: true, thumbnail: true,
      property_category: true, property_sub_type: true,
      address: true, country: true, pincode: true, latitude: true, wizard_step: true,
      _count: { select: { hotelRooms: true, images: true } },
    },
  });

  return { ...owner, verifiedByName: verifiedByMember?.name ?? null, hotels };
}

export type HotelOwnerDetail = NonNullable<Awaited<ReturnType<typeof getHotelOwnerDetail>>>;

// ── Verification ──────────────────────────────────────────────────────────────

export type VerifyResult = { ok: boolean; error?: string };

export async function markOwnerVerified(ownerId: string): Promise<VerifyResult> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const owner = await db.hotelOwner.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) return { ok: false, error: "Hotel owner not found." };

  await db.hotelOwner.update({
    where: { id: ownerId },
    data: { verifiedAt: new Date(), verifiedById: session.user.id },
  });

  revalidatePath("/dashboard/hotel-owners");
  revalidatePath(`/dashboard/hotel-owners/${ownerId}`);
  return { ok: true };
}

export async function unmarkOwnerVerified(ownerId: string): Promise<VerifyResult> {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const owner = await db.hotelOwner.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) return { ok: false, error: "Hotel owner not found." };

  await db.hotelOwner.update({
    where: { id: ownerId },
    data: { verifiedAt: null, verifiedById: null },
  });

  revalidatePath("/dashboard/hotel-owners");
  revalidatePath(`/dashboard/hotel-owners/${ownerId}`);
  return { ok: true };
}
