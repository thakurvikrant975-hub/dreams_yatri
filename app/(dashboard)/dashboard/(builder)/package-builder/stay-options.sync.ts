// ─────────────────────────────────────────────────────────────────────────────
// Keeping the day row and the recommended stay option in step.
//
// A plain module, deliberately NOT the "use server" file next door. Every
// export in that file is a callable endpoint, and syncRecommendedStayFromDays
// is a write: it creates a package's first stay option, moves the recommended
// flag when nothing holds it, and overwrites that option's stay rows from the
// day rows. Its only caller is saveCustomPackage, which has already decided
// the viewer may edit — so exporting it as an action published an
// unauthenticated write of a package's stays to anyone holding a package id.
//
// Guarding it would have worked; removing it from the action surface is
// better, because there is then nothing to guard. Same reasoning that moved
// composePackagePrice out to package-price-utils.ts.
//
// The mirror exists because the day row is the compatibility surface. It
// carries the RECOMMENDED option's stay, and everything not yet taught about
// options — the v1 builder, the hotel-request workflow, the pricing service's
// package-level path — goes on reading it and gets the stay the client is
// being steered toward.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/app/lib/db";
import type { TransactionClient } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma";

/** The hotel columns a stay row and a day row share. One list, so a column
 * added to one side can't quietly go missing from the other. */
export const STAY_FIELDS = [
  "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
  "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
  "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
  "roomPricingId", "roomsCount", "extraRooms", "hotelCheckIn", "hotelCheckOut", "hotelMealPlan",
  "manualHotelPricePerNight", "manualExtraBeds", "manualExtraBedRate", "hotelPriceOverride",
  "hotelPending", "hotelPendingNote",
] as const;

type StayFields = Partial<Record<(typeof STAY_FIELDS)[number], unknown>>;

export function pickStayFields<T extends StayFields>(source: T): StayFields {
  const out: StayFields = {};
  for (const key of STAY_FIELDS) if (key in source) out[key] = source[key];
  return out;
}

/** Copies the recommended option's stays onto their day rows — the
 * compatibility surface everything that predates options still reads. */
export async function mirrorRecommendedOntoDays(tx: TransactionClient, packageId: string): Promise<void> {
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

/** The mirror run backwards: day rows to the recommended option's stays.
 *
 * Also gives a package its first option, so one created after this existed —
 * createCustomPackage knows nothing about options — still has the Standard the
 * document needs to render. Safe on every save: it converges.
 *
 * Callers are responsible for authorisation. There is exactly one
 * (saveCustomPackage), and it has already run the workspace capability check
 * by the time it gets here. See this file's header for why that is a comment
 * rather than a check.
 */
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
          data: { customPackageId: packageId, label: "Standard", sortOrder: 0, isRecommended: true },
          select: { id: true },
        });
  }

  // Replaced wholesale rather than upserted one day at a time.
  //
  // This ran on every save, and a save is what the builder does constantly —
  // so a fifteen-day package paid fifteen sequential round trips to Neon
  // before it could return, every time. Two queries now, whatever the length.
  //
  // Safe here in a way it is emphatically NOT for day rows: this option's
  // stays are BY DEFINITION a copy of the day rows, every column of them is
  // about to be rewritten from those rows anyway, and nothing anywhere
  // references a stay row by id — the table has no inbound foreign keys and
  // bookings record the option, not the row. There is nothing in these rows
  // to preserve that the next line does not immediately put back.
  //
  // In one transaction, so a save that fails midway cannot leave the
  // recommended option with no stays at all.
  await db.$transaction([
    db.custom_itinerary_stays.deleteMany({ where: { stayOptionId: recommended.id } }),
    db.custom_itinerary_stays.createMany({
      data: days.map((day) => ({
        itineraryId: day.id,
        stayOptionId: recommended!.id,
        ...pickStayFields(day),
      })) as Prisma.custom_itinerary_staysUncheckedCreateInput[],
    }),
  ]);
}
