"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { ensureHomestayRoom } from "@/app/lib/hotel-inventory/homestay-room-sync";

/**
 * DEV auto-approve: a validly-submitted property goes straight to LIVE (simulating
 * a successful backend review) and gets a public URL. Fails closed by design — an
 * unset/misconfigured env var must never accidentally skip human review in
 * production. Opt in explicitly per-environment with HOTEL_AUTO_APPROVE=true.
 */
const AUTO_APPROVE = process.env.HOTEL_AUTO_APPROVE === "true";

export type PublishResult = { ok: boolean; missing?: string[]; url?: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Mirrors photo-actions.ts's proceedPhotos gate — kept in sync so a host can't
// slip past the wizard's photo tab and then delete photos back down before
// hitting Save & Continue on the final Submit step.
const MIN_TOTAL_PHOTOS = 6;
const MIN_ROOM_TAGGED_PHOTOS = 2;
const ROOM_TAG = "Bedroom";

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
  roomTaggedImageCount: number;
  ownerEmailVerified: boolean;
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

  if (h.imageCount < MIN_TOTAL_PHOTOS) {
    m.push(`At least ${MIN_TOTAL_PHOTOS} photos (currently ${h.imageCount})`);
  } else if (h.roomTaggedImageCount < MIN_ROOM_TAGGED_PHOTOS) {
    m.push(`At least ${MIN_ROOM_TAGGED_PHOTOS} photos tagged "${ROOM_TAG}"`);
  }
  if (!h.check_in_time || !h.check_out_time) m.push("Check-in / check-out times");
  if (!h.cancellation_policy) m.push("Cancellation policy");
  if (!h.bank_account_number || !h.bank_ifsc_code) m.push("Bank account details");
  if (!h.pan_number) m.push("PAN number");
  if (!h.ownerEmailVerified) m.push("Verify your account email (check your inbox for the verification link)");
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
      images: { select: { tags: true } },
      owner: { select: { email_verified: true } },
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
    imageCount: h.images.length,
    roomTaggedImageCount: h.images.filter((img) => img.tags.includes(ROOM_TAG)).length,
    ownerEmailVerified: h.owner?.email_verified ?? false,
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

  // Homestay/Villa wizard never creates a hotel_rooms row (it's edited as a
  // single unit) — provision the canonical "Entire Property" room + pricing
  // so it's bookable through the same pipeline as a hotel room.
  await ensureHomestayRoom(hotelId);

  revalidatePath(`/hotel-connect/properties/${hotelId}/edit`);
  revalidatePath("/hotel-connect/properties");
  redirect(`/hotel-connect/properties/${hotelId}/edit`);
}
