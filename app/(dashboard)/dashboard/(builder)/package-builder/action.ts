"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { db } from "@/app/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types (exported so pages can import them)
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryRow {
  id:             string;
  name:           string;
  phone:          string;
  countryCode:    string;
  email:          string | null;
  destination:    string | null;
  travelDate:     Date | null;
  groupSize:      number | null;
  assignedToName: string | null;
  assignedAt:     Date | null;
  updatedAt:      Date;
  requirements:   any;
  status:         string;
}

export interface QueryDetail extends QueryRow {
  message: string | null;
  customPackage: {
    id:              string;
    status:          string;
    title:           string;
    pricePerPerson:  number | null;
    totalPrice:      number | null;
    flightsIncluded: boolean;
    flightNotes:     string | null;
    trainIncluded:   boolean;
    trainNotes:      string | null;
    itineraries:     DayItinerary[];
  } | null;
}

export interface ActivityInput {
  id?:          string;
  title:        string;
  description:  string;
}

export interface DayItinerary {
  id?:            string;
  day:            number;
  title:          string;
  description:    string;
  activities:     ActivityInput[];
  meals:          string[];
  accommodation:  string;
  hotelCheckIn:   string;
  hotelCheckOut:  string;
  hotelMealPlan:  string;
  transport:      string;
  notes:          string;
}

export interface PackageInput {
  queryId:         string;
  title:           string;
  destination:     string;
  startingPoint:   string;
  totalDays:       number;
  totalNights:     number;
  travelDate:      string;
  adults:          number;
  children:        number;
  infants:         number;
  pricePerPerson:  number | null;
  totalPrice:      number | null;
  currency:        string;
  inclusions:      string[];
  exclusions:      string[];
  termsNotes:      string;
  flightsIncluded: boolean;
  flightNotes:     string;
  trainIncluded:   boolean;
  trainNotes:      string;
  status:          "DRAFT" | "READY";
  itineraries:     DayItinerary[];
}

export interface PaginatedQueries {
  queries:    QueryRow[];
  total:      number;
  page:       number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List all IN_PROGRESS queries pending package creation
// ─────────────────────────────────────────────────────────────────────────────
export async function getPackageBuilderQueries({
  page    = 1,
  size    = 20,
  search  = "",
}: {
  page?:   number;
  size?:   number;
  search?: string;
}): Promise<PaginatedQueries> {
  const safeSize = Math.min(size, 50);
  const skip     = (page - 1) * safeSize;

  const searchFilter = search
    ? {
        OR: [
          { name:        { contains: search, mode: "insensitive" as const } },
          { destination: { contains: search, mode: "insensitive" as const } },
          { phone:       { contains: search } },
        ],
      }
    : {};

  const where = {
    status: "IN_PROGRESS" as const,
    ...searchFilter,
  };

  const [total, queries] = await Promise.all([
    db.package_queries.count({ where }),
    db.package_queries.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: safeSize,
      select: {
        id:             true,
        name:           true,
        phone:          true,
        countryCode:    true,
        email:          true,
        destination:    true,
        travelDate:     true,
        groupSize:      true,
        assignedToName: true,
        assignedAt:     true,
        updatedAt:      true,
        requirements:   true,
        status:         true,
      },
    }),
  ]);

  return {
    queries: queries as QueryRow[],
    total,
    page,
    totalPages: Math.ceil(total / safeSize),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get single query detail (with existing custom package if any)
// ─────────────────────────────────────────────────────────────────────────────
export async function getQueryDetail(queryId: string): Promise<QueryDetail | null> {
  const query = await db.package_queries.findUnique({
    where: { id: queryId },
    select: {
      id:             true,
      name:           true,
      phone:          true,
      countryCode:    true,
      email:          true,
      destination:    true,
      travelDate:     true,
      groupSize:      true,
      assignedToName: true,
      assignedAt:     true,
      updatedAt:      true,
      requirements:   true,
      status:         true,
      message:        true,
      // custom_packages is a singular 1:1 relation (queryId is @unique on
      // custom_packages), so no take/orderBy here — those only apply to
      // to-many relations.
      custom_packages: {
        select: {
          id:              true,
          status:          true,
          title:           true,
          pricePerPerson:  true,
          totalPrice:      true,
          flightsIncluded: true,
          flightNotes:     true,
          trainIncluded:   true,
          trainNotes:      true,
          itineraries: {
            orderBy: { day: "asc" },
            select: {
              id:            true,
              day:           true,
              title:         true,
              description:   true,
              meals:         true,
              accommodation: true,
              hotelCheckIn:  true,
              hotelCheckOut: true,
              hotelMealPlan: true,
              transport:     true,
              notes:         true,
              activities: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, description: true },
              },
            },
          },
        },
      },
    },
  });

  if (!query) return null;

  return {
    ...(query as any),
    customPackage: query.custom_packages ?? null,
  } as QueryDetail;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Save (create or update) a custom package with itineraries
// ─────────────────────────────────────────────────────────────────────────────
export async function saveCustomPackage(input: PackageInput): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const {
      queryId, title, destination, startingPoint,
      totalDays, totalNights, travelDate, adults, children, infants,
      pricePerPerson, totalPrice, currency, inclusions, exclusions,
      termsNotes, flightsIncluded, flightNotes, trainIncluded, trainNotes,
      status, itineraries,
    } = input;

    const { teamMemberId, teamMemberName } = await getCurrentActor();
    const builtBy = teamMemberId ?? "unknown";
    const builtByName = teamMemberName ?? "Sales Executive";

    // Upsert the custom package (unique on queryId)
    const pkg = await db.custom_packages.upsert({
      where:  { queryId },
      create: {
        queryId,
        title,
        destination,
        startingPoint:   startingPoint || null,
        totalDays,
        totalNights,
        travelDate:      travelDate ? new Date(travelDate) : null,
        adults,
        children,
        infants,
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        currency,
        inclusions,
        exclusions,
        termsNotes:      termsNotes || null,
        flightsIncluded,
        flightNotes:     flightNotes || null,
        trainIncluded,
        trainNotes:      trainNotes || null,
        status,
        builtBy,
        builtByName:     builtByName || null,
      },
      update: {
        title,
        destination,
        startingPoint:   startingPoint || null,
        totalDays,
        totalNights,
        travelDate:      travelDate ? new Date(travelDate) : null,
        adults,
        children,
        infants,
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        currency,
        inclusions,
        exclusions,
        termsNotes:      termsNotes || null,
        flightsIncluded,
        flightNotes:     flightNotes || null,
        trainIncluded,
        trainNotes:      trainNotes || null,
        status,
        builtByName:     builtByName || null,
      },
    });

    // Replace itineraries (and their nested activities, via cascade) — delete
    // all then recreate. Nested `activities.create` needs one create per day
    // rather than createMany, since createMany can't take nested writes.
    await db.custom_itineraries.deleteMany({
      where: { customPackageId: pkg.id },
    });

    if (itineraries.length > 0) {
      await db.$transaction(
        itineraries.map((it) =>
          db.custom_itineraries.create({
            data: {
              customPackageId: pkg.id,
              day:             it.day,
              title:           it.title,
              description:     it.description || null,
              meals:           it.meals,
              accommodation:   it.accommodation || null,
              hotelCheckIn:    it.hotelCheckIn || null,
              hotelCheckOut:   it.hotelCheckOut || null,
              hotelMealPlan:   it.hotelMealPlan || null,
              transport:       it.transport || null,
              notes:           it.notes || null,
              activities: {
                create: it.activities
                  .filter((a) => a.title.trim())
                  .map((a, idx) => ({
                    title:       a.title,
                    description: a.description || null,
                    sortOrder:   idx,
                  })),
              },
            },
          }),
        ),
      );
    }

    revalidatePath("/dashboard/package-builder");

    return { id: pkg.id, success: true };
  } catch (err) {
    console.error("[saveCustomPackage]", err);
    return { id: "", success: false, error: "Failed to save package" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Mark package as SENT → update query status → return WhatsApp URL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPackageToClient(packageId: string): Promise<{
  success:      boolean;
  whatsappUrl?: string;
  error?:       string;
}> {
  try {
    const pkg = await db.custom_packages.findUnique({
      where:   { id: packageId },
      include: {
        query:       true,
        itineraries: { orderBy: { day: "asc" } },
      },
    });

    if (!pkg) return { success: false, error: "Package not found" };

    // ── Build WhatsApp deep-link ─────────────────────────────────────────────
    const rawPhone  = pkg.query.phone.replace(/\D/g, "");
    const country   = pkg.query.countryCode ?? "91";
    const fullPhone = rawPhone.startsWith(country) ? rawPhone : `${country}${rawPhone}`;

    const travelDateStr = pkg.travelDate
      ? new Date(pkg.travelDate).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : "TBD";

    const paxLine =
      `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}` +
      (pkg.children ? `, ${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}` : "") +
      (pkg.infants  ? `, ${pkg.infants} Infant${pkg.infants !== 1 ? "s" : ""}` : "");

    const priceStr = pkg.totalPrice
      ? `${pkg.currency} ${Number(pkg.totalPrice).toLocaleString("en-IN")}`
      : "To be confirmed";

    const transportLine = [
      pkg.flightsIncluded ? "✈️ Flights included" : null,
      pkg.trainIncluded ? "🚆 Train included" : null,
    ].filter(Boolean).join(" · ");

    const message = [
      `Hi ${pkg.query.name} 👋`,
      ``,
      `Your customised *${pkg.title}* package is ready! 🎉`,
      ``,
      `📍 *Destination:* ${pkg.destination}`,
      `🚗 *Starting From:* ${pkg.startingPoint ?? pkg.query.destination ?? "—"}`,
      `📅 *Travel Date:* ${travelDateStr}`,
      `🌙 *Duration:* ${pkg.totalDays} Days / ${pkg.totalNights} Nights`,
      `👥 *Travellers:* ${paxLine}`,
      `💰 *Total Price:* ${priceStr}`,
      ...(transportLine ? [transportLine] : []),
      ``,
      `Please check your email for the detailed itinerary PDF.`,
      `Let us know if you'd like any changes! 🙏`,
    ].join("\n");

    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

    // ── Update DB ────────────────────────────────────────────────────────────
    await db.$transaction([
      db.custom_packages.update({
        where: { id: packageId },
        data:  { status: "SENT", sentAt: new Date() },
      }),
      db.package_queries.update({
        where: { id: pkg.queryId },
        data:  { status: "PACKAGE_SENT" },
      }),
    ]);

    // ── Trigger email (plug in your email service here) ──────────────────────
    // if (pkg.query.email) {
    //   await sendPackageEmail({ to: pkg.query.email, name: pkg.query.name, pkg });
    // }

    revalidatePath("/dashboard/package-builder");

    return { success: true, whatsappUrl };
  } catch (err) {
    console.error("[sendPackageToClient]", err);
    return { success: false, error: "Failed to send package" };
  }
}
