"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Adding, removing and reading the stay tiers on a package.
//
// The one rule everything here exists to hold: custom_itineraries still carries
// the hotel columns inline, and those columns are now a MIRROR of the default
// option's stay. Every reader that hasn't been taught about tiers yet — the v1
// builder, the hotel-request workflow, PDF export, the client's published page —
// goes on reading the day row and gets the default tier, unchanged. So any write
// that could change which stay is the default one, or what that stay says, has
// to re-mirror in the same transaction. That is mirrorDefaultOntoDays below, and
// it is why these mutations live in one place instead of being inlined wherever
// a hotel gets picked.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
// TransactionClient from db, not Prisma.TransactionClient — the client is
// $extends-ed (the connection-retry wrapper), and the stock type doesn't match
// what $transaction actually hands a callback. See the note in app/lib/db.ts.
import type { TransactionClient } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveWorkspaceCaps, workspaceRoleOf, ownsPackage } from "./workspace-caps";
import { isStarTier, pickStayFields, sortStayOptions } from "./stay-options";

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

/** Can this member change the package's structure right now? Same rule the rest
 * of the builder uses — the owning exec, while the package is theirs to edit. */
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
    status: pkg.status,
    verified: pkg.verified,
    rejectedAt: pkg.rejectedAt,
    revisionRequestedAt: pkg.revisionRequestedAt,
  }, {
    isOwner: ownsPackage({
      viewerId: memberCtx?.member?.id,
      viewerRoleName: memberCtx?.member?.teamRole?.name,
      builtBy: pkg.builtBy,
      queryAssignedTo: pkg.query?.assignedTo,
    }),
  });
  if (!caps.editItinerary) {
    return { ok: false, error: "This package isn't yours to edit right now." };
  }
  return { ok: true };
}

/** Copies the default option's stays onto their day rows. See the module note:
 * the day columns are the compatibility surface for everything that predates
 * tiers, so they must never be left describing a tier the client isn't being
 * quoted. Runs inside the caller's transaction. */
async function mirrorDefaultOntoDays(tx: TransactionClient, packageId: string): Promise<void> {
  const defaultOption = await tx.custom_package_stay_options.findFirst({
    where: { customPackageId: packageId, isDefault: true },
    select: { id: true },
  });
  if (!defaultOption) return;

  const stays = await tx.custom_itinerary_stays.findMany({
    where: { stayOptionId: defaultOption.id },
  });

  for (const stay of stays) {
    await tx.custom_itineraries.update({
      where: { id: stay.itineraryId },
      data: pickStayFields(stay) as Prisma.custom_itinerariesUpdateInput,
    });
  }
}

/** Adds a tier and gives it an (empty) stay row for every day the package
 * already has.
 *
 * Empty rather than copied from the default on purpose: a 4★ option pre-filled
 * with the 3★ hotels is a quote that looks finished and is wrong, and the exec
 * would have to notice every day to fix it. Empty days are visibly unfinished,
 * and the existing gap/pending machinery already knows how to say so. */
export async function addStayOption(packageId: string, starRating: number): Promise<Result<{ id: string }>> {
  try {
    if (!isStarTier(starRating)) return { success: false, error: "Pick a star rating between 2 and 5." };
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const existing = await db.custom_package_stay_options.findFirst({
      where: { customPackageId: packageId, starRating },
      select: { id: true },
    });
    if (existing) return { success: false, error: `This package already has a ${starRating} Star option.` };

    const created = await db.$transaction(async (tx) => {
      const optionCount = await tx.custom_package_stay_options.count({ where: { customPackageId: packageId } });
      const option = await tx.custom_package_stay_options.create({
        data: {
          customPackageId: packageId,
          starRating,
          // The very first option on a package is its default, so a package
          // can never end up with options and nothing to render.
          isDefault: optionCount === 0,
          sortOrder: optionCount,
        },
        select: { id: true },
      });

      const days = await tx.custom_itineraries.findMany({
        where: { customPackageId: packageId },
        select: { id: true },
      });
      if (days.length > 0) {
        await tx.custom_itinerary_stays.createMany({
          data: days.map((d) => ({ itineraryId: d.id, stayOptionId: option.id })),
        });
      }

      if (optionCount === 0) await mirrorDefaultOntoDays(tx, packageId);
      return option;
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    return { success: true, data: created };
  } catch (err) {
    console.error("[addStayOption]", err);
    return { success: false, error: "Couldn't add that stay option." };
  }
}

/** Removes a tier and everything quoted under it. Refuses to leave the package
 * with none: there has to be something to print. Removing the default promotes
 * the next option and re-mirrors, so the day rows never describe a tier that no
 * longer exists. */
export async function removeStayOption(packageId: string, optionId: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const options = await db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId },
      select: { id: true, isDefault: true, starRating: true, sortOrder: true },
    });
    const target = options.find((o) => o.id === optionId);
    if (!target) return { success: false, error: "That stay option no longer exists." };
    if (options.length <= 1) {
      return { success: false, error: "A package needs at least one stay option — add another before removing this one." };
    }

    await db.$transaction(async (tx) => {
      await tx.custom_package_stay_options.delete({ where: { id: optionId } });
      if (target.isDefault) {
        const next = sortStayOptions(options.filter((o) => o.id !== optionId))[0];
        await tx.custom_package_stay_options.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
      await mirrorDefaultOntoDays(tx, packageId);
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[removeStayOption]", err);
    return { success: false, error: "Couldn't remove that stay option." };
  }
}

/** Moves the default flag, then re-mirrors — which is what actually changes
 * what the PDF, the published page and the v1 builder show. */
export async function setDefaultStayOption(packageId: string, optionId: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const target = await db.custom_package_stay_options.findFirst({
      where: { id: optionId, customPackageId: packageId },
      select: { id: true },
    });
    if (!target) return { success: false, error: "That stay option no longer exists." };

    await db.$transaction(async (tx) => {
      await tx.custom_package_stay_options.updateMany({
        where: { customPackageId: packageId },
        data: { isDefault: false },
      });
      await tx.custom_package_stay_options.update({
        where: { id: optionId },
        data: { isDefault: true },
      });
      await mirrorDefaultOntoDays(tx, packageId);
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[setDefaultStayOption]", err);
    return { success: false, error: "Couldn't change the default stay option." };
  }
}

/** Writes one (day × tier) cell — the hotel pick itself. Mirrors onto the day
 * row when the tier being written is the default one. */
export async function saveStayForDay(
  packageId: string,
  optionId: string,
  itineraryId: string,
  fields: Record<string, unknown>,
): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const option = await db.custom_package_stay_options.findFirst({
      where: { id: optionId, customPackageId: packageId },
      select: { id: true, isDefault: true },
    });
    if (!option) return { success: false, error: "That stay option no longer exists." };

    // Only ever the stay columns, whatever else the caller passed — this write
    // must not become a back door into the rest of the day row.
    const data = pickStayFields(fields);

    await db.$transaction(async (tx) => {
      await tx.custom_itinerary_stays.upsert({
        where: { itineraryId_stayOptionId: { itineraryId, stayOptionId: optionId } },
        create: { itineraryId, stayOptionId: optionId, ...data } as Prisma.custom_itinerary_staysUncheckedCreateInput,
        update: data as Prisma.custom_itinerary_staysUncheckedUpdateInput,
      });
      if (option.isDefault) {
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

/** Every tier on a package with its per-day stays, cheapest first — the read
 * the builder's tier bar, the costing comparison and the document all start
 * from. */
export async function getStayOptions(packageId: string) {
  const options = await db.custom_package_stay_options.findMany({
    where: { customPackageId: packageId },
    include: {
      stays: {
        include: { itinerary: { select: { day: true } } },
      },
    },
  });

  return sortStayOptions(options).map((o) => ({
    id: o.id,
    starRating: o.starRating,
    label: o.label,
    isDefault: o.isDefault,
    sortOrder: o.sortOrder,
    pricePerPerson: o.pricePerPerson,
    totalPrice: o.totalPrice,
    stays: o.stays
      .map((s) => ({ ...s, day: s.itinerary.day }))
      .sort((a, b) => a.day - b.day),
  }));
}
