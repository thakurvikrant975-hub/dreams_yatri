"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Reading and editing a package's stay categories.
//
// The day row still carries the hotel columns inline, and they now hold the
// RECOMMENDED category's stay. Everything not yet taught about categories — the
// v1 builder, the hotel-request workflow, the pricing service's package-level
// path, the PDF's single-category layout — goes on reading the day row and gets
// the stay the client is being steered toward. Any write that could change
// which category is recommended, or what its stay says, re-mirrors here.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import type { TransactionClient } from "@/app/lib/db";
import type { Prisma, StayCategory } from "@/app/generated/prisma";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveWorkspaceCaps, workspaceRoleOf, ownsPackage } from "./workspace-caps";
import { sortStayCategories, type StayCategoryName } from "./stay-categories";

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

/** The hotel columns a stay row and a day row share. One list, so a column
 * added to one side can't quietly go missing from the other. */
const STAY_FIELDS = [
  "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
  "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
  "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
  "roomPricingId", "roomsCount", "extraRooms", "hotelCheckIn", "hotelCheckOut", "hotelMealPlan",
  "manualHotelPricePerNight", "manualExtraBeds", "manualExtraBedRate", "hotelPriceOverride",
  "hotelPending", "hotelPendingNote",
] as const;

type StayFields = Partial<Record<(typeof STAY_FIELDS)[number], unknown>>;

function pickStayFields<T extends StayFields>(source: T): StayFields {
  const out: StayFields = {};
  for (const key of STAY_FIELDS) if (key in source) out[key] = source[key];
  return out;
}

async function assertCanEdit(packageId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [pkg, memberCtx] = await Promise.all([
    db.custom_packages.findUnique({
      where: { id: packageId },
      select: {
        status: true, verified: true, rejectedAt: true, revisionRequestedAt: true,
        builtBy: true, query: { select: { assignedTo: true } },
      },
    }),
    getEffectiveMember(),
  ]);
  if (!pkg) return { ok: false, error: "Package not found" };

  const caps = resolveWorkspaceCaps(workspaceRoleOf(memberCtx?.member?.teamRole?.name), {
    status: pkg.status, verified: pkg.verified,
    rejectedAt: pkg.rejectedAt, revisionRequestedAt: pkg.revisionRequestedAt,
  }, {
    isOwner: ownsPackage({
      viewerId: memberCtx?.member?.id,
      viewerRoleName: memberCtx?.member?.teamRole?.name,
      builtBy: pkg.builtBy,
      queryAssignedTo: pkg.query?.assignedTo,
    }),
  });
  return caps.editItinerary
    ? { ok: true }
    : { ok: false, error: "This package isn't yours to edit right now." };
}

/** Copies the recommended category's stays onto their day rows — the
 * compatibility surface everything that predates categories still reads. */
async function mirrorRecommendedOntoDays(tx: TransactionClient, packageId: string): Promise<void> {
  const recommended = await tx.custom_package_stay_options.findFirst({
    where: { customPackageId: packageId, isRecommended: true },
    select: { id: true },
  });
  if (!recommended) return;

  const stays = await tx.custom_itinerary_stays.findMany({ where: { stayOptionId: recommended.id } });
  for (const stay of stays) {
    await tx.custom_itineraries.update({
      where: { id: stay.itineraryId },
      data: pickStayFields(stay) as Prisma.custom_itinerariesUpdateInput,
    });
  }
}

/** The mirror run backwards: day rows to the recommended category's stays.
 *
 * Also gives a package its first category, so one created after this existed —
 * createCustomPackage knows nothing about categories — still has the Standard
 * the document needs to render. Safe on every save: it converges. */
export async function syncRecommendedStayFromDays(packageId: string): Promise<void> {
  const days = await db.custom_itineraries.findMany({ where: { customPackageId: packageId } });

  let recommended = await db.custom_package_stay_options.findFirst({
    where: { customPackageId: packageId, isRecommended: true },
    select: { id: true },
  });

  if (!recommended) {
    const existing = await db.custom_package_stay_options.findFirst({
      where: { customPackageId: packageId },
      select: { id: true },
    });
    recommended = existing
      ? await db.custom_package_stay_options.update({
          where: { id: existing.id }, data: { isRecommended: true }, select: { id: true },
        })
      : await db.custom_package_stay_options.create({
          data: { customPackageId: packageId, category: "STANDARD", isRecommended: true },
          select: { id: true },
        });
  }

  for (const day of days) {
    const data = pickStayFields(day);
    await db.custom_itinerary_stays.upsert({
      where: { itineraryId_stayOptionId: { itineraryId: day.id, stayOptionId: recommended.id } },
      create: { itineraryId: day.id, stayOptionId: recommended.id, ...data } as Prisma.custom_itinerary_staysUncheckedCreateInput,
      update: data as Prisma.custom_itinerary_staysUncheckedUpdateInput,
    });
  }
}

/** Adds a standard, with an empty stay row per day.
 *
 * Empty rather than copied from the recommended one on purpose: a Premium
 * column pre-filled with the Standard hotel is a quote that looks finished and
 * is wrong, and every night would have to be noticed to fix it. */
export async function addStayCategory(packageId: string, category: StayCategoryName): Promise<Result<{ id: string }>> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const existing = await db.custom_package_stay_options.findFirst({
      where: { customPackageId: packageId, category: category as StayCategory },
      select: { id: true },
    });
    if (existing) return { success: false, error: `This package already has a ${category.toLowerCase()} option.` };

    const created = await db.$transaction(async (tx) => {
      const count = await tx.custom_package_stay_options.count({ where: { customPackageId: packageId } });
      const option = await tx.custom_package_stay_options.create({
        data: {
          customPackageId: packageId,
          category: category as StayCategory,
          // The first category on a package is the one recommended, so the
          // document always has a badge to show and a price to lead with.
          isRecommended: count === 0,
        },
        select: { id: true },
      });
      const days = await tx.custom_itineraries.findMany({
        where: { customPackageId: packageId }, select: { id: true },
      });
      if (days.length > 0) {
        await tx.custom_itinerary_stays.createMany({
          data: days.map((d) => ({ itineraryId: d.id, stayOptionId: option.id })),
        });
      }
      if (count === 0) await mirrorRecommendedOntoDays(tx, packageId);
      return option;
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true, data: created };
  } catch (err) {
    console.error("[addStayCategory]", err);
    return { success: false, error: "Couldn't add that stay option." };
  }
}

/** Removes a standard and everything quoted under it. Never the last one —
 * the document has to have a stay to print. */
export async function removeStayCategory(packageId: string, optionId: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const options = await db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId },
      select: { id: true, category: true, isRecommended: true },
    });
    const target = options.find((o) => o.id === optionId);
    if (!target) return { success: false, error: "That stay option no longer exists." };
    if (options.length <= 1) {
      return { success: false, error: "A package needs at least one stay option." };
    }

    await db.$transaction(async (tx) => {
      await tx.custom_package_stay_options.delete({ where: { id: optionId } });
      if (target.isRecommended) {
        // The badge has to land somewhere, so the cheapest survivor takes it.
        const next = sortStayCategories(
          options.filter((o) => o.id !== optionId)
            .map((o) => ({ ...o, category: o.category as StayCategoryName })),
        )[0];
        await tx.custom_package_stay_options.update({
          where: { id: next.id }, data: { isRecommended: true },
        });
      }
      await mirrorRecommendedOntoDays(tx, packageId);
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[removeStayCategory]", err);
    return { success: false, error: "Couldn't remove that stay option." };
  }
}

/** Moves the badge — and with it the highlighted price and what the day rows
 * mirror, since the recommended stay is the one everything else reads. */
export async function setRecommendedStayCategory(packageId: string, optionId: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const target = await db.custom_package_stay_options.findFirst({
      where: { id: optionId, customPackageId: packageId }, select: { id: true },
    });
    if (!target) return { success: false, error: "That stay option no longer exists." };

    await db.$transaction(async (tx) => {
      await tx.custom_package_stay_options.updateMany({
        where: { customPackageId: packageId }, data: { isRecommended: false },
      });
      await tx.custom_package_stay_options.update({
        where: { id: optionId }, data: { isRecommended: true },
      });
      await mirrorRecommendedOntoDays(tx, packageId);
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[setRecommendedStayCategory]", err);
    return { success: false, error: "Couldn't change the recommended option." };
  }
}

/** Writes one (day x category) cell — the hotel pick itself. Mirrors onto the
 * day row when the category written is the recommended one. */
export async function saveStayForDay(
  packageId: string, optionId: string, itineraryId: string, fields: Record<string, unknown>,
): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const option = await db.custom_package_stay_options.findFirst({
      where: { id: optionId, customPackageId: packageId },
      select: { id: true, isRecommended: true },
    });
    if (!option) return { success: false, error: "That stay option no longer exists." };

    // Only the stay columns, whatever else the caller passed — this must not
    // become a back door into the rest of the day row.
    const data = pickStayFields(fields);

    await db.$transaction(async (tx) => {
      await tx.custom_itinerary_stays.upsert({
        where: { itineraryId_stayOptionId: { itineraryId, stayOptionId: optionId } },
        create: { itineraryId, stayOptionId: optionId, ...data } as Prisma.custom_itinerary_staysUncheckedCreateInput,
        update: data as Prisma.custom_itinerary_staysUncheckedUpdateInput,
      });
      if (option.isRecommended) {
        await tx.custom_itineraries.update({
          where: { id: itineraryId },
          data: data as Prisma.custom_itinerariesUpdateInput,
        });
      }
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[saveStayForDay]", err);
    return { success: false, error: "Couldn't save that hotel." };
  }
}

/** The categories as the document wants them: each standard, its price, and its
 * hotel for every night. Shaped to drop straight into PreviewData.stayCategories.
 */
export async function getStayCategoriesForDocument(packageId: string) {
  const options = await db.custom_package_stay_options.findMany({
    where: { customPackageId: packageId },
    include: {
      stays: { include: { itinerary: { select: { day: true } } } },
    },
  });

  return sortStayCategories(
    options.map((o) => ({ ...o, category: o.category as StayCategoryName })),
  ).map((o) => ({
    id: o.id,
    category: o.category,
    isRecommended: o.isRecommended,
    totalPrice: o.totalPrice,
    pricePerPerson: o.pricePerPerson,
    byDay: Object.fromEntries(o.stays.map((s) => [s.itinerary.day, {
      hotel: s.accommodation,
      photo: s.accommodationPhoto,
      location: s.accommodationLocation,
      starRating: s.accommodationStarRating,
      mealPlan: s.hotelMealPlan,
      rooms: s.roomsCount,
      checkIn: s.hotelCheckIn,
      checkOut: s.hotelCheckOut,
    }])),
  }));
}
