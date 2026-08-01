"use server";

// verify-packages/[id]/pdf/actions.ts
//
// Assembles the same PreviewData shape the package builder feeds into
// ItineraryDocument/ItineraryPdfExport, but from a read-only fetch instead
// of the builder's interactive `form` state — so a reviewer (e.g. Costing
// Manager) can get the exact graphical PDF a sales exec sees, without
// needing Package Builder page access. Mirrors the `if (data.customPackage)`
// hydration block and the `previewForm` merge in
// package-builder/[packageId]/page.tsx; keep the two in sync if either
// changes what it derives from a saved package.

import { db } from "@/app/lib/db";
import {
  getPackageDetail, getDestinationCoverImage,
  type StopInput,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { getItinerarySettings } from "../../../itinerary-settings/actions";
import { computeBuilderHotelPricing, computeBuilderCabPricing } from "@/app/services/package-pricing.service";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { parseRoomSelections, parseCabSelections } from "@/app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";

const TICKET_MARGIN_PCT = 5;

function recalcFromStops(stops: StopInput[]) {
  const totalNights = stops.reduce((sum, s) => sum + (s.nights || 0), 0);
  return {
    totalNights,
    totalDays: totalNights + 1,
    destination: stops.map((s) => s.name).filter(Boolean).join(", "),
  };
}

export async function getPackagePdfPreviewData(packageId: string): Promise<PreviewData | null> {
  const data = await getPackageDetail(packageId);
  if (!data || !data.customPackage) return null;
  const cp = data.customPackage;

  const [settings, stopImageEntries] = await Promise.all([
    getItinerarySettings(),
    Promise.all(
      [...new Set(cp.stops.map((s) => s.name).filter(Boolean))]
        .map(async (name) => [name, await getDestinationCoverImage(name)] as const),
    ),
  ]);

  const j = (data.requirements as { journey?: { departurePoints?: string[]; pickupPoints?: string[] } } | null)?.journey;

  const sizing = cp.stops.length > 0
    ? recalcFromStops(cp.stops)
    : cp.itineraries.length > 0
      ? { totalDays: cp.itineraries.length, totalNights: Math.max(0, cp.itineraries.length - 1), destination: data.destination ?? "" }
      : { totalDays: cp.totalDays, totalNights: cp.totalNights, destination: data.destination ?? "" };

  // pricePerPerson/totalPrice on the row are only ever explicitly typed in
  // on the Pricing tab — plenty of packages reach review relying entirely on
  // the auto-computed hotel+cab+ticket+margin+GST total instead, same as
  // this page's own live pricing snapshot (verify-packages/[id]/page.tsx).
  // Falling back to "" here (rather than mirroring that computation) is what
  // produced a real "To be confirmed" PDF for an already-priced package.
  let pricePerPerson = cp.pricePerPerson;
  let totalPrice = cp.totalPrice;
  if (pricePerPerson == null || totalPrice == null) {
    const overrides = await db.custom_packages.findUnique({
      where: { id: packageId },
      select: { hotelSubtotalOverride: true, cabSubtotalOverride: true },
    });
    const travelDateIso = cp.travelDate ? cp.travelDate.toISOString().slice(0, 10) : null;
    const [hotelPricing, cabPricing] = await Promise.all([
      computeBuilderHotelPricing({
        travelDate: travelDateIso, adults: cp.adults, children: cp.children,
        days: cp.itineraries.map((it) => ({
          day: it.day, roomPricingId: it.roomPricingId, roomsCount: it.roomsCount ?? null,
          extraRooms: parseRoomSelections(it.extraRooms),
          manualHotelPricePerNight: it.manualHotelPricePerNight,
          ...splitManualHotelName(it.accommodation),
        })),
      }),
      computeBuilderCabPricing({
        travelDate: travelDateIso,
        days: cp.itineraries.map((it) => ({
          day: it.day, cabPricingId: it.cabPricingId, transportDistanceKm: it.transportDistanceKm,
          cabQuantity: it.cabQuantity ?? null, extraCabs: parseCabSelections(it.extraCabs),
        })),
      }),
    ]);
    const hotelSubtotal = overrides?.hotelSubtotalOverride ?? hotelPricing.hotelSubtotal;
    const cabSubtotal = overrides?.cabSubtotalOverride ?? cabPricing.cabSubtotal;
    const ticketsSubtotal = cp.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0);
    const addonsSubtotal = cp.addOns.reduce((sum, a) => sum + (a.price ?? 0) * (a.quantity || 1), 0);
    const hotelCabBase = hotelSubtotal + cabSubtotal;
    const baseCost = hotelCabBase + addonsSubtotal + ticketsSubtotal;
    const hotelCabMarginAmount = Math.round((hotelCabBase + addonsSubtotal) * cp.marginPercentage / 100);
    const ticketsMarginAmount = Math.round(ticketsSubtotal * TICKET_MARGIN_PCT / 100);
    const taxable = baseCost + hotelCabMarginAmount + ticketsMarginAmount;
    const gstAmount = Math.round(taxable * cp.gstPercentage / 100);
    const finalPrice = taxable + gstAmount;
    const totalPax = cp.adults + cp.children;
    totalPrice ??= finalPrice;
    pricePerPerson ??= totalPax > 0 ? Math.round(finalPrice / totalPax) : finalPrice;
  }

  return {
    title: cp.title,
    description: cp.description ?? "",
    coverImage: cp.coverImage ?? "",
    coverImagePosition: cp.coverImagePosition ?? 50,
    destination: sizing.destination,
    startingPoint: j?.departurePoints?.join(", ") ?? j?.pickupPoints?.join(", ") ?? "",
    totalDays: sizing.totalDays,
    totalNights: sizing.totalNights,
    travelDate: cp.travelDate ? cp.travelDate.toISOString().slice(0, 10) : "",
    adults: cp.adults,
    children: cp.children,
    infants: cp.infants,
    pricePerPerson: pricePerPerson != null ? String(pricePerPerson) : "",
    totalPrice: totalPrice != null ? String(totalPrice) : "",
    currency: "INR",
    // Inclusions/exclusions/T&C/payment/amendment/benefits are always the
    // live company-wide defaults (never the possibly-stale copy saved on the
    // package row) plus this package's own additions — same rule the builder
    // itself applies.
    inclusions: [...settings.inclusions, ...cp.extraPolicyItems.inclusions],
    exclusions: [...settings.exclusions, ...cp.extraPolicyItems.exclusions],
    termsNotes: cp.termsNotes ?? "",
    termsConditions: [...settings.termsConditions, ...cp.extraPolicyItems.termsConditions],
    paymentPolicy: [...settings.paymentPolicy, ...cp.extraPolicyItems.paymentPolicy],
    amendmentPolicy: [...settings.amendmentPolicy, ...cp.extraPolicyItems.amendmentPolicy],
    travelBenefits: [...settings.travelBenefits, ...cp.extraPolicyItems.travelBenefits],
    customPolicySections: settings.customPolicySections,
    stops: cp.stops,
    itineraries: cp.itineraries.length > 0
      ? cp.itineraries.map((it, idx) => ({ ...it, day: idx + 1 }))
      : cp.itineraries,
    tickets: cp.tickets,
    addOns: cp.addOns,
    clientName: data.name ?? "",
    clientPhone: data.phone ? `${data.countryCode ?? ""} ${data.phone}`.trim() : "",
    clientEmail: data.email ?? "",
    queryId: data.id,
    execName: data.assignedToName ?? "",
    execEmail: data.execEmail ?? "",
    execDesignation: data.execDesignation ?? "",
    stopImages: Object.fromEntries(stopImageEntries),
    companySettings: {
      phone: settings.companyPhone,
      email: settings.companyEmail,
      address: settings.companyAddress,
      description: settings.companyDescription,
      disclaimer: settings.documentDisclaimer,
    },
  };
}
