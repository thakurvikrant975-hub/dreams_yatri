"use server";

// Public, no-auth data access for a client-facing itinerary link — deliberately
// separate from the dashboard's `getQueryDetail` (package-builder/action.ts),
// which returns internal query/lead data never meant to be reachable without
// a session. Only ever returns a package once it has actually been sent —
// a draft/in-progress itinerary is never visible via this path, even to
// someone who knows the id.

import { db } from "@/app/lib/db";

export async function getSharedPackage(packageId: string) {
  const pkg = await db.custom_packages.findFirst({
    where: { id: packageId, status: "SENT" },
    select: {
      title: true, description: true, coverImage: true, destination: true, startingPoint: true,
      totalDays: true, totalNights: true, travelDate: true, adults: true, children: true, infants: true,
      pricePerPerson: true, totalPrice: true, currency: true,
      inclusions: true, exclusions: true, termsNotes: true,
      flightsIncluded: true, flightNotes: true, flightFrom: true, flightTo: true,
      trainIncluded: true, trainNotes: true, trainFrom: true, trainTo: true,
      stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true } },
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
      query: { select: { assignedTo: true } },
    },
  });
  if (!pkg) return null;

  const exec = pkg.query.assignedTo
    ? await db.teamMember.findUnique({
        where: { id: pkg.query.assignedTo },
        select: { name: true, email: true, designation: true },
      })
    : null;

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
    flightsIncluded: pkg.flightsIncluded,
    flightNotes:     pkg.flightNotes ?? "",
    flightFrom:      pkg.flightFrom ?? "",
    flightTo:        pkg.flightTo ?? "",
    trainIncluded:   pkg.trainIncluded,
    trainNotes:      pkg.trainNotes ?? "",
    trainFrom:       pkg.trainFrom ?? "",
    trainTo:         pkg.trainTo ?? "",
    stops:           pkg.stops,
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
