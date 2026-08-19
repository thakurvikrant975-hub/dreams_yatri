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
import type { Prisma } from "@/app/generated/prisma";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveWorkspaceCaps, workspaceRoleOf, ownsPackage } from "./workspace-caps";
import {
  sortStayOptions, normaliseStayLabel, stayLabelProblem, MAX_STAY_OPTIONS,
} from "./stay-options";
import { computeStayOptionPricing } from "@/app/services/package-pricing.service";
import { mirrorRecommendedOntoDays, pickStayFields } from "./stay-options.sync";

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

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

/** Who is allowed to read a package's stay options.
 *
 * Every export in a "use server" file is a callable endpoint, so these reads
 * were reachable by anyone who knew a package id — handing out the hotels and
 * per-option pricing of packages that had never been sent.
 *
 * Two ways in, and they mirror the visibility rule the client page already
 * enforces (see getSharedPackage): a signed-in team member may read any
 * package, and everyone else may read one only once it has been SENT — which
 * is exactly the state at which those options are already printed on the
 * client's own document.
 *
 * Which way in is the answer, not just whether: the two are allowed to see
 * different things. Everything the client's own document prints goes to
 * both; the fields only the editor uses go to staff alone.
 */
async function stayOptionAccess(packageId: string): Promise<"staff" | "client" | null> {
  const member = await getEffectiveMember();
  if (member?.member?.id) return "staff";
  const sent = await db.custom_packages.findFirst({
    where: { id: packageId, status: "SENT" },
    select: { id: true },
  });
  return sent ? "client" : null;
}

/** Adds an option, with an empty stay row per day.
 *
 * Empty rather than copied from the recommended one on purpose: a Premium
 * column pre-filled with the Standard hotel is a quote that looks finished and
 * is wrong, and every night would have to be noticed to fix it.
 *
 * Adding is always optional — a package quotes one stay until someone asks for
 * more, and nothing in the builder requires a second. */
export async function addStayOption(packageId: string, rawLabel: string): Promise<Result<{ id: string }>> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const existing = await db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId },
      select: { id: true, label: true, sortOrder: true },
    });
    if (existing.length >= MAX_STAY_OPTIONS) {
      return { success: false, error: `Three stay options is the most a document can show side by side.` };
    }
    const problem = stayLabelProblem(rawLabel, existing);
    if (problem) return { success: false, error: problem };
    const label = normaliseStayLabel(rawLabel);

    const created = await db.$transaction(async (tx) => {
      const option = await tx.custom_package_stay_options.create({
        data: {
          customPackageId: packageId,
          label,
          sortOrder: existing.reduce((max, o) => Math.max(max, o.sortOrder), -1) + 1,
          // The first option on a package is the one recommended, so the
          // document always has something to badge and a price to lead with.
          isRecommended: existing.length === 0,
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
      if (existing.length === 0) await mirrorRecommendedOntoDays(tx, packageId);
      return option;
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true, data: created };
  } catch (err) {
    console.error("[addStayOption]", err);
    return { success: false, error: "Couldn't add that stay option." };
  }
}

/** Renames an option. The label is what the client reads as the column
 * heading, so it has to be present and unique within the package. */
export async function renameStayOption(packageId: string, optionId: string, rawLabel: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const existing = await db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId }, select: { id: true, label: true },
    });
    if (!existing.some((o) => o.id === optionId)) {
      return { success: false, error: "That stay option no longer exists." };
    }
    const problem = stayLabelProblem(rawLabel, existing, optionId);
    if (problem) return { success: false, error: problem };

    await db.custom_package_stay_options.update({
      where: { id: optionId }, data: { label: normaliseStayLabel(rawLabel) },
    });
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[renameStayOption]", err);
    return { success: false, error: "Couldn't rename that stay option." };
  }
}

/** Removes a standard and everything quoted under it. Never the last one —
 * the document has to have a stay to print. */
export async function removeStayOption(packageId: string, optionId: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const options = await db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId },
      select: { id: true, label: true, sortOrder: true, isRecommended: true },
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
        const next = sortStayOptions(options.filter((o) => o.id !== optionId))[0];
        await tx.custom_package_stay_options.update({
          where: { id: next.id }, data: { isRecommended: true },
        });
      }
      await mirrorRecommendedOntoDays(tx, packageId);
    });

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true };
  } catch (err) {
    console.error("[removeStayOption]", err);
    return { success: false, error: "Couldn't remove that stay option." };
  }
}

/** Moves the badge — and with it the highlighted price and what the day rows
 * mirror, since the recommended stay is the one everything else reads. */
export async function setRecommendedStayOption(packageId: string, optionId: string): Promise<Result> {
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
    console.error("[setRecommendedStayOption]", err);
    return { success: false, error: "Couldn't change the recommended option." };
  }
}

/** Writes one (day x category) cell — the hotel pick itself. Mirrors onto the
 * day row when the category written is the recommended one. */
export async function saveStayForDay(
  packageId: string, optionId: string,
  /** Day NUMBERS, not row ids. saveCustomPackage deletes and recreates the day
   * rows on every save, so an id read into the browser a minute ago may already
   * be gone; the day number is what survives.
   *
   * Takes the whole run at once. A stay is one hotel over N nights, so picking
   * one used to fire N calls — each re-checking permissions, re-resolving the
   * option, opening its own transaction and revalidating the route. A ten-night
   * stay was ten round-trips for one click, and a failure halfway left the run
   * half-written. */
  days: number | number[],
  fields: Record<string, unknown>,
): Promise<Result> {
  try {
    const gate = await assertCanEdit(packageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const option = await db.custom_package_stay_options.findFirst({
      where: { id: optionId, customPackageId: packageId },
      select: { id: true, isRecommended: true },
    });
    if (!option) return { success: false, error: "That stay option no longer exists." };

    const wanted = Array.isArray(days) ? days : [days];
    if (wanted.length === 0) return { success: true };

    const itineraries = await db.custom_itineraries.findMany({
      where: { customPackageId: packageId, day: { in: wanted } },
      select: { id: true, day: true },
    });
    const missing = wanted.filter((d) => !itineraries.some((it) => it.day === d));
    if (missing.length > 0) {
      return {
        success: false,
        error: `Day ${missing.join(", ")} isn't part of this package any more — reload and try again.`,
      };
    }

    // Only the stay columns, whatever else the caller passed — this must not
    // become a back door into the rest of the day row.
    const data = pickStayFields(fields);

    // One transaction for the whole run: either every night of the stay moves
    // to the new hotel or none does. Written night by night, a failure on the
    // third left a stay describing two hotels.
    await db.$transaction(async (tx) => {
      for (const it of itineraries) {
        await tx.custom_itinerary_stays.upsert({
          where: { itineraryId_stayOptionId: { itineraryId: it.id, stayOptionId: optionId } },
          create: { itineraryId: it.id, stayOptionId: optionId, ...data } as Prisma.custom_itinerary_staysUncheckedCreateInput,
          update: data as Prisma.custom_itinerary_staysUncheckedUpdateInput,
        });
        if (option.isRecommended) {
          await tx.custom_itineraries.update({
            where: { id: it.id },
            data: data as Prisma.custom_itinerariesUpdateInput,
          });
        }
      }
    }, { timeout: 20_000, maxWait: 8_000 });

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
export async function getStayOptionsForDocument(packageId: string) {
  // Returns nothing rather than throwing: every caller already renders a
  // single-stay document when the list is empty, so a refused read degrades to
  // the old layout instead of breaking the page.
  const access = await stayOptionAccess(packageId);
  if (!access) return [];
  const isStaff = access === "staff";

  // Which figure wins: the one frozen on the option, or a live recomputation.
  //
  // A settled package (out for review, sent, or answered) must show what was
  // quoted — recomputing would restate an old quote at today's catalog rates,
  // and on a SENT package that is the number the client agreed to. A DRAFT is
  // the opposite: it is being edited, so the price has to follow the hotels
  // being changed. Without this a rejected package — which returns to DRAFT —
  // sat in the builder showing the prices frozen when it was submitted, beside
  // hotels the exec had since replaced.
  const [pkgState, options] = await Promise.all([
    db.custom_packages.findUnique({ where: { id: packageId }, select: { status: true } }),
    db.custom_package_stay_options.findMany({
      where: { customPackageId: packageId },
      include: { stays: { include: { itinerary: { select: { day: true } } } } },
    }),
  ]);
  const editable = pkgState?.status === "DRAFT";

  // Live figures, for the options not yet frozen — and ONLY for those. A
  // stored price always wins where there is one, so on a settled package with
  // every option priced the result was computed and then thrown away.
  //
  // That is the whole cost of this read. computeStayOptionPricing prices the
  // cabs once and then every option's hotels, night by night, against the
  // catalog — and this action is what the client's published page calls, on a
  // route that renders per request. Every view of a sent quote ran the pricing
  // engine to answer a question the stored figures had already answered.
  const needsLive = editable
    || options.some((o) => o.totalPrice == null || o.pricePerPerson == null);
  const priced = needsLive
    ? await computeStayOptionPricing(packageId).catch(() => [])
    : [];
  const livePrice = new Map(priced.map((p) => [p.id, p]));

  return sortStayOptions(options).map((o) => ({
    id: o.id,
    label: o.label,
    sortOrder: o.sortOrder,
    isRecommended: o.isRecommended,
    totalPrice: editable
      ? livePrice.get(o.id)?.totalPrice ?? o.totalPrice ?? null
      : o.totalPrice ?? livePrice.get(o.id)?.totalPrice ?? null,
    pricePerPerson: editable
      ? livePrice.get(o.id)?.pricePerPerson ?? o.pricePerPerson ?? null
      : o.pricePerPerson ?? livePrice.get(o.id)?.pricePerPerson ?? null,
    byDay: Object.fromEntries(o.stays.map((s) => [s.itinerary.day, {
      hotel: s.accommodation,
      photo: s.accommodationPhoto,
      location: s.accommodationLocation,
      starRating: s.accommodationStarRating,
      mealPlan: s.hotelMealPlan,
      rooms: s.roomsCount,
      checkIn: s.hotelCheckIn,
      checkOut: s.hotelCheckOut,
      // Editor-only, and withheld from the client outright rather than just
      // left unread. This action is reachable by anyone once the package is
      // SENT, and the published page hands whatever it returns straight to
      // the browser — so roomPricingId was publishing an internal catalog id,
      // and hotelPending was telling the client which of their nights the
      // hotel team has not actually secured yet. The document reads neither.
      roomPricingId: isStaff ? s.roomPricingId : null,
      pending: isStaff ? s.hotelPending : false,
      extraBeds: s.manualExtraBeds,
    }])),
  }));
}

/** Everything the costing manager needs to check the options in one look: each
 * one's price, and the hotel it puts on every single night.
 *
 * This is the "several hotels to verify for the same night" view. A reviewer
 * checking two options is checking two hotels against the same night, and
 * reading that as two separate itineraries is how a night gets approved at one
 * standard and priced at the other.
 *
 * Prices are the LIVE computation rather than the frozen figure: costing is
 * reviewing what the trip costs now, against rates they may be about to
 * correct, not what was quoted last week.
 */
export async function getStayOptionComparison(packageId: string) {
  // Staff only — this one has no public caller, and it carries the internal
  // hotel subtotals and costing's own corrections.
  const member = await getEffectiveMember();
  if (!member?.member?.id) return { days: [], options: [] };

  const [options, days, priced] = await Promise.all([
    getStayOptionsForDocument(packageId),
    db.custom_itineraries.findMany({
      where: { customPackageId: packageId },
      select: { day: true, title: true },
      orderBy: { day: "asc" },
    }),
    computeStayOptionPricing(packageId).catch(() => []),
  ]);
  const live = new Map(priced.map((p) => [p.id, p]));

  return {
    days: days.map((d) => ({ day: d.day, title: d.title })),
    options: options.map((o) => ({
      ...o,
      totalPrice: live.get(o.id)?.totalPrice ?? o.totalPrice ?? null,
      pricePerPerson: live.get(o.id)?.pricePerPerson ?? o.pricePerPerson ?? null,
      hotelSubtotal: live.get(o.id)?.hotelSubtotal ?? null,
      hotelSubtotalOverridden: live.get(o.id)?.hotelSubtotalOverridden ?? false,
      gapDays: live.get(o.id)?.gapDays ?? [],
      baseRateDays: live.get(o.id)?.baseRateDays ?? [],
    })),
  };
}

/** Copies a package's stay options onto another package.
 *
 * Duplicating a package returns a payload describing its DAY rows, and the day
 * row carries only the recommended option — so a duplicate of a package quoted
 * at three standards silently arrived quoting one. This runs once the duplicate
 * has an id of its own and puts the rest back.
 *
 * Matched on day number, which is safe here in a way it is not during a save: a
 * duplicate is a straight copy, so its days are the source's days in the same
 * order, and nothing has been renumbered in between.
 *
 * Refuses if the target already has more than the one option it was created
 * with, so re-running it cannot double up.
 */
export async function cloneStayOptionsInto(sourcePackageId: string, targetPackageId: string): Promise<Result> {
  try {
    const gate = await assertCanEdit(targetPackageId);
    if (!gate.ok) return { success: false, error: gate.error };

    const [source, targetOptions, targetDays] = await Promise.all([
      db.custom_package_stay_options.findMany({
        where: { customPackageId: sourcePackageId },
        include: { stays: { include: { itinerary: { select: { day: true } } } } },
      }),
      db.custom_package_stay_options.findMany({
        where: { customPackageId: targetPackageId }, select: { id: true, label: true },
      }),
      db.custom_itineraries.findMany({
        where: { customPackageId: targetPackageId }, select: { id: true, day: true },
      }),
    ]);
    if (source.length === 0) return { success: true };
    if (targetOptions.length > 1) return { success: true };

    const idByDay = new Map(targetDays.map((d) => [d.day, d.id]));
    const existingLabels = new Set(targetOptions.map((o) => o.label.toLowerCase()));

    for (const option of sortStayOptions(source)) {
      // The recommended option is already on the duplicate — it came across on
      // the day rows — so only the others are recreated.
      if (option.isRecommended || existingLabels.has(option.label.toLowerCase())) continue;

      const created = await db.custom_package_stay_options.create({
        data: {
          customPackageId: targetPackageId,
          label: option.label,
          sortOrder: option.sortOrder,
          isRecommended: false,
        },
        select: { id: true },
      });

      const rows = option.stays
        .filter((st) => idByDay.has(st.itinerary.day))
        .map((st) => {
          const { id: _id, itineraryId: _i, itinerary: _it, stayOptionId: _s, createdAt: _c, updatedAt: _u, ...fields } = st;
          return {
            ...fields,
            extraRooms: (fields.extraRooms ?? undefined) as Prisma.InputJsonValue | undefined,
            itineraryId: idByDay.get(st.itinerary.day)!,
            stayOptionId: created.id,
          };
        });
      if (rows.length > 0) {
        await db.custom_itinerary_stays.createMany({ data: rows, skipDuplicates: true });
      }
    }

    revalidatePath(`/dashboard/package-builder-v2/${targetPackageId}`);
    return { success: true };
  } catch (err) {
    console.error("[cloneStayOptionsInto]", err);
    return { success: false, error: "Couldn't copy the stay options across." };
  }
}
