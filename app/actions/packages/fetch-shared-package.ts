"use server";

// Public, no-auth data access for a client-facing itinerary link — deliberately
// separate from the dashboard's `getQueryDetail` (package-builder/action.ts),
// which returns internal query/lead data never meant to be reachable without
// a session. Only ever returns a package once it has actually been sent —
// a draft/in-progress itinerary is never visible via this path, even to
// someone who knows the id.

import { db } from "@/app/lib/db";
import { getDestinationCoverImage } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

export async function getSharedPackage(packageId: string) {
  const pkg = await db.custom_packages.findFirst({
    where: { id: packageId, status: "SENT" },
    select: {
      queryId: true,
      title: true, description: true, coverImage: true, destination: true, startingPoint: true,
      totalDays: true, totalNights: true, travelDate: true, adults: true, children: true, infants: true,
      pricePerPerson: true, totalPrice: true, currency: true,
      inclusions: true, exclusions: true, termsNotes: true,
      stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true } },
      tickets: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, type: true, provider: true, ticketNumber: true,
          fromPlace: true, toPlace: true, departureTime: true, arrivalTime: true, durationText: true,
          pickupPoint: true, dropPoint: true, adults: true, children: true, infants: true,
          ticketCount: true, fare: true, notes: true,
        },
      },
      itineraries: {
        orderBy: { day: "asc" },
        select: {
          day: true, title: true, description: true, meals: true,
          accommodation: true, accommodationPhoto: true, accommodationRoomPhotos: true,
          accommodationLocation: true, accommodationRoomSpecs: true, accommodationRoomCapacity: true,
          hotelCheckIn: true, hotelCheckOut: true, hotelMealPlan: true,
          transport: true, transportPhoto: true, transportVehicleType: true, transportSeats: true,
          transportPickup: true, transportDrop: true, transportDistanceKm: true, notes: true,
          activities: {
            orderBy: { sortOrder: "asc" },
            select: { title: true, description: true, photo: true, photos: true, photoLabels: true },
          },
        },
      },
      query: { select: { assignedTo: true, name: true, phone: true, countryCode: true, email: true } },
    },
  });
  if (!pkg) return null;

  const exec = pkg.query.assignedTo
    ? await db.teamMember.findUnique({
        where: { id: pkg.query.assignedTo },
        select: { name: true, email: true, designation: true },
      })
    : null;

  // Real destination photos for the "Places You Gonna Visit" strip — same
  // catalog lookup the builder's own cover-photo suggestion uses, resolved
  // here (server-side) so the client-facing link shows real photos too, not
  // just the internal builder preview.
  const stopNames = [...new Set(pkg.stops.map((s) => s.name.trim()).filter(Boolean))];
  const stopImageEntries = await Promise.all(
    stopNames.map(async (name) => [name, await getDestinationCoverImage(name)] as const),
  );
  const stopImages = Object.fromEntries(stopImageEntries);

  return {
    title:           pkg.title,
    description:     pkg.description ?? "",
    coverImage:      pkg.coverImage ?? "",
    destination:     pkg.destination,
    startingPoint:   pkg.startingPoint ?? "",
    totalDays:       pkg.totalDays,
    totalNights:     pkg.totalNights,
    travelDate:      pkg.travelDate ? pkg.travelDate.toISOString().slice(0, 10) : "",
    adults:          pkg.adults,
    children:        pkg.children,
    infants:         pkg.infants,
    pricePerPerson:  pkg.pricePerPerson?.toString() ?? "",
    totalPrice:      pkg.totalPrice?.toString() ?? "",
    currency:        pkg.currency,
    inclusions:      pkg.inclusions,
    exclusions:      pkg.exclusions,
    termsNotes:      pkg.termsNotes ?? "",
    stops:           pkg.stops,
    stopImages,
    tickets: pkg.tickets.map((t) => ({
      id:            t.id,
      type:          t.type,
      provider:      t.provider ?? "",
      ticketNumber:  t.ticketNumber ?? "",
      fromPlace:     t.fromPlace ?? "",
      toPlace:       t.toPlace ?? "",
      departureTime: t.departureTime ?? "",
      arrivalTime:   t.arrivalTime ?? "",
      durationText:  t.durationText ?? "",
      pickupPoint:   t.pickupPoint ?? "",
      dropPoint:     t.dropPoint ?? "",
      adults:        t.adults,
      children:      t.children,
      infants:       t.infants,
      ticketCount:   t.ticketCount,
      fare:          t.fare ?? null,
      notes:         t.notes ?? "",
    })),
    itineraries: pkg.itineraries.map((it) => ({
      day:                       it.day,
      title:                     it.title,
      description:               it.description ?? "",
      activities: it.activities.map((a) => ({
        title:       a.title,
        description: a.description ?? "",
        photo:       a.photo ?? "",
        photos:      a.photos,
        photoLabels: a.photoLabels,
      })),
      meals:                     it.meals,
      accommodation:             it.accommodation ?? "",
      accommodationPhoto:        it.accommodationPhoto ?? "",
      accommodationRoomPhotos:   it.accommodationRoomPhotos,
      accommodationLocation:     it.accommodationLocation ?? "",
      accommodationRoomSpecs:    it.accommodationRoomSpecs ?? "",
      accommodationRoomCapacity: it.accommodationRoomCapacity ?? null,
      roomPricingId:             null,
      hotelCheckIn:              it.hotelCheckIn ?? "",
      hotelCheckOut:             it.hotelCheckOut ?? "",
      hotelMealPlan:             it.hotelMealPlan ?? "",
      transport:                 it.transport ?? "",
      transportPhoto:            it.transportPhoto ?? "",
      transportVehicleType:      it.transportVehicleType ?? "",
      transportSeats:            it.transportSeats ?? null,
      transportPickup:           it.transportPickup ?? "",
      transportPickupLat:        null,
      transportPickupLng:        null,
      transportDrop:             it.transportDrop ?? "",
      transportDistanceKm:       it.transportDistanceKm ?? null,
      cabPricingId:              null,
      notes:                     it.notes ?? "",
    })),
    clientName:      pkg.query.name,
    clientPhone:     pkg.query.phone ? `${pkg.query.countryCode} ${pkg.query.phone}` : "",
    clientEmail:     pkg.query.email ?? "",
    queryId:         pkg.queryId,
    execName:        exec?.name ?? "",
    execEmail:       exec?.email ?? "",
    execDesignation: exec?.designation ?? "",
  };
}

/** Fire-and-forget — records that the client actually opened the link. */
export async function markPackageViewed(packageId: string): Promise<void> {
  await db.custom_packages.update({
    where: { id: packageId },
    data: { viewCount: { increment: 1 }, viewedAt: new Date() },
  }).catch(() => {});
}
