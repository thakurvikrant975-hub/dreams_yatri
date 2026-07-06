"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

/**
 * DEV auto-approve: a validly-submitted property goes straight to LIVE (simulating
 * a successful backend review) and gets a public URL. Flip to a real review queue
 * by setting HOTEL_AUTO_APPROVE=false — then it goes to SUBMITTED for the team.
 */
const AUTO_APPROVE = process.env.HOTEL_AUTO_APPROVE !== "false";

export type PublishResult = { ok: boolean; missing?: string[]; url?: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Field-level completeness check before a property can go live. */
function validate(h: {
  name: string | null;
  property_category: string | null;
  property_sub_type: string | null;
  star_rating: number | null;
  contact_email: string | null;
  contact_mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: unknown;
  longitude: unknown;
  check_in_time: string | null;
  check_out_time: string | null;
  cancellation_policy: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  pan_number: string | null;
  prop_base_rate: unknown;
  roomsWithPricing: number;
  imageCount: number;
}): string[] {
  const m: string[] = [];
  const isHomestay = h.property_category === "HOMESTAY_VILLA";

  if (!h.name || h.name === "My Property") m.push("Property name");
  if (!h.contact_email && !h.contact_mobile) m.push("Contact email or mobile");
  if (!h.address || !h.city || !h.state || !h.pincode) m.push("Full address (address, city, state, pincode)");
  if (h.latitude == null || h.longitude == null) m.push("Map location (pin)");
  if (!isHomestay && h.property_sub_type !== "GUEST_HOUSE" && !h.star_rating) m.push("Star rating");

  if (isHomestay) {
    if (h.prop_base_rate == null) m.push("Base price");
  } else if (h.roomsWithPricing === 0) {
    m.push("At least one room with a price");
  }

  if (h.imageCount === 0) m.push("At least one photo");
  if (!h.check_in_time || !h.check_out_time) m.push("Check-in / check-out times");
  if (!h.cancellation_policy) m.push("Cancellation policy");
  if (!h.bank_account_number || !h.bank_ifsc_code) m.push("Bank account details");
  if (!h.pan_number) m.push("PAN number");
  return m;
}

export async function submitForReview(
  hotelId: number,
  _prev?: PublishResult,
  _formData?: FormData,
): Promise<PublishResult> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const h = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: {
      id: true, name: true, slug: true, listing_status: true,
      property_category: true, property_sub_type: true, star_rating: true,
      contact_email: true, contact_mobile: true,
      address: true, city: true, state: true, pincode: true, latitude: true, longitude: true,
      check_in_time: true, check_out_time: true, cancellation_policy: true,
      bank_account_number: true, bank_ifsc_code: true, pan_number: true, prop_base_rate: true,
      hotelRooms: {
        where: { is_active: true },
        select: { id: true, pricing: { where: { is_active: true }, select: { id: true }, take: 1 } },
      },
      _count: { select: { images: true } },
    },
  });
  if (!h) return { ok: false, missing: ["Property not found"] };

  // Already submitted / live — just go back.
  if (h.listing_status !== "DRAFT" && h.listing_status !== "REJECTED") {
    redirect(`/hotel-connect/properties/${hotelId}/edit`);
  }

  const missing = validate({
    ...h,
    roomsWithPricing: h.hotelRooms.filter((r) => r.pricing.length > 0).length,
    imageCount: h._count.images,
  });
  if (missing.length > 0) return { ok: false, missing };

  // Give it a clean public slug if it still has the auto-generated draft slug.
  const needsSlug = !h.slug || h.slug.startsWith("draft-");
  const slug = needsSlug ? `${slugify(h.name ?? "property")}${h.city ? `-${slugify(h.city)}` : ""}-${h.id}` : h.slug;

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      slug,
      submitted_at: new Date(),
      listing_status: AUTO_APPROVE ? "LIVE" : "SUBMITTED",
    },
  });

  revalidatePath(`/hotel-connect/properties/${hotelId}/edit`);
  revalidatePath("/hotel-connect/properties");
  redirect(`/hotel-connect/properties/${hotelId}/edit`);
}
