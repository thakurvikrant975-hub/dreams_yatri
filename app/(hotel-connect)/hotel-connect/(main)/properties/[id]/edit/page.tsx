import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell, { HOTEL_WIZARD_TABS, HOMESTAY_WIZARD_TABS } from "./WizardShell";
import BasicInfoTab from "./tabs/BasicInfoTab";
import HomestayBasicInfoTab, { type HomestayBasicInfo } from "./tabs/HomestayBasicInfoTab";
import HomestayRoomsTab, { type HomestayRoomsData } from "./tabs/HomestayRoomsTab";
import type { OwnerProfile } from "./tabs/HostDetailsSection";
import LocationTab from "./tabs/LocationTab";
import AmenitiesTab, { type HotelAmenitiesInfo } from "./tabs/AmenitiesTab";
import PhotosTab, { type PhotoCategory } from "./tabs/PhotosTab";
import PoliciesTab, { type PoliciesHotelData } from "./tabs/PoliciesTab";
import FinanceTab, { type FinanceHotelData } from "./tabs/FinanceTab";
import TabPlaceholder from "./tabs/TabPlaceholder";

// Both hotel and homestay: 6 tabs, Photos (tab 4) manages its own uploads.
const TABS_WITH_FORM = new Set([1, 2, 3, 5, 6]);

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const hotelId = parseInt(id, 10);
  if (isNaN(hotelId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true,
      name: true,
      listing_status: true,
      wizard_step: true,
      property_category: true,
      property_sub_type: true,
      // basic-info fields
      star_rating: true,
      year_built: true,
      booking_since_year: true,
      has_channel_manager: true,
      channel_manager_name: true,
      contact_email: true,
      contact_mobile_cc: true,
      contact_mobile: true,
      whatsapp_same_as_mobile: true,
      contact_whatsapp: true,
      contact_landline: true,
      // homestay-specific fields
      hosted_as: true,
      host_lives_at_property: true,
      hs_bedrooms: true,
      hs_bathrooms: true,
      hs_has_kitchen: true,
      hs_bedroom_details: true,
      hs_bathroom_details: true,
      hs_kitchen_details: true,
      hs_space_items: true,
      // location fields
      address: true,
      landmark: true,
      city: true,
      state: true,
      country: true,
      pincode: true,
      latitude: true,
      longitude: true,
      // amenities fields
      property_amenities: true,
      // policy fields
      check_in_time: true,
      check_out_time: true,
      cancellation_policy: true,
      allow_unmarried_couples: true,
      show_couple_tag: true,
      allow_guests_below_18: true,
      allow_male_only_groups: true,
      allow_same_city_id: true,
      smoking_allowed: true,
      parties_events_allowed: true,
      wheelchair_accessible: true,
      allow_outside_visitors: true,
      pets_on_property: true,
      pets_allowed: true,
      allowed_pet_types: true,
      pet_extra_charges: true,
      pets_restricted_areas: true,
      pets_without_leash: true,
      pet_food_available: true,
      checkin_24_hours: true,
      acceptable_id_proofs: true,
      infant_free_occupancy: true,
      infant_complimentary_food: true,
      extra_bed_included: true,
      provide_bed_extra_adults: true,
      provide_bed_extra_kids: true,
      extra_bed_adults_avail: true,
      extra_bed_adults_types: true,
      extra_cot_charge_adult: true,
      extra_mattress_charge_adult: true,
      extra_sofa_charge_adult: true,
      extra_bed_kids_avail: true,
      extra_bed_kids_types: true,
      extra_cot_charge_child: true,
      extra_mattress_charge_child: true,
      extra_sofa_charge_child: true,
      extra_crib_charge_child: true,
      meal_price_breakfast: true,
      meal_price_lunch: true,
      meal_price_dinner: true,
      // finance fields
      bank_account_number: true,
      bank_ifsc_code: true,
      bank_name: true,
      bank_consent_given: true,
      gstin_number: true,
      pan_number: true,
      business_type: true,
      msme_number: true,
      property_documents: true,
      // photo count — used to gate tab 4 completion tick
      _count: { select: { images: true } },
    },
  });
  if (!hotel) notFound();

  // Fetch owner profile for HomestayBasicInfoTab host-details section
  const ownerRecord = hotel.property_category === "HOMESTAY_VILLA"
    ? await db.hotelOwner.findUnique({
        where: { id: ownerId },
        select: {
          id: true, name: true, email: true,
          phone: true, phone_cc: true,
          whatsapp: true, whatsapp_cc: true,
          businessName: true, logo_url: true,
          gender: true, languages: true,
          founded_year: true, property_count: true,
          business_description: true,
        },
      })
    : null;

  // Prisma returns Decimal objects for latitude/longitude — not serializable to
  // Client Components. Convert once here so every usage below is plain numbers.
  const h = {
    ...hotel,
    latitude:  hotel.latitude  != null ? Number(hotel.latitude)  : null,
    longitude: hotel.longitude != null ? Number(hotel.longitude) : null,
  };

  const isHomestay  = h.property_category === "HOMESTAY_VILLA";
  const activeTabs = isHomestay ? HOMESTAY_WIZARD_TABS : HOTEL_WIZARD_TABS;
  const maxTab = activeTabs.length; // always 6 now

  // Compute how far the wizard is ACTUALLY complete based on saved DB data.
  function effectiveWizardStep(): number {
    if (!h.property_category) return 0;
    if (
      !h.address ||
      !h.city ||
      !h.state ||
      !h.country ||
      !h.pincode ||
      h.latitude == null
    ) return 1;
    if (isHomestay) {
      // Tab 3 — Rooms & Spaces: gated until wizard_step reaches 4
      if (h.wizard_step < 4) return 2;
    }
    // Tab 4 — Photos: completed once at least one photo is uploaded
    if (h._count.images === 0) return 3;
    return Math.max(h.wizard_step, 4);
  }

  const currentTab = Math.max(1, Math.min(maxTab, parseInt(tab ?? "1", 10) || 1));

  // Photos is always tab 4 for both hotel and homestay
  let photoCategories: PhotoCategory[] = [];
  if (currentTab === 4) {
    const rawCats = await db.hotel_image_categories.findMany({
      where: { hotel_id: hotelId },
      orderBy: { sort_order: "asc" },
      include: {
        images: {
          orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        },
      },
    });
    photoCategories = rawCats.map((cat) => ({
      id: cat.id,
      name: cat.name,
      is_system: cat.is_system,
      photos: cat.images.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnail: img.thumbnail,
        tags: img.tags as string[],
        is_primary: img.is_primary,
        category_id: img.category_id,
        sort_order: img.sort_order,
      })),
    }));
  }
  const tabLabel = activeTabs[currentTab - 1]?.label ?? "";

  // Tab 3 for HOMESTAY: Phase 1 (room counts not yet saved) hides the footer button.
  const isHomestayTab3CountsPending =
    currentTab === 3 && isHomestay && h.hs_bedrooms == null;
  const tabFormId = !TABS_WITH_FORM.has(currentTab) ? undefined : "wizard-form";

  // Tab 3 HOMESTAY Phase 1: show tab's own button first; once counts saved, show footer "Save & Continue"
  const hideNextButton = isHomestayTab3CountsPending;

  const tabContent =
    currentTab === 1 ? (
      isHomestay
        ? <HomestayBasicInfoTab hotel={h as unknown as HomestayBasicInfo} owner={ownerRecord as unknown as OwnerProfile} />
        : <BasicInfoTab hotel={h} />
    ) : currentTab === 2 ? (
      <LocationTab hotel={h} />
    ) : currentTab === 3 ? (
      isHomestay
        ? <HomestayRoomsTab hotel={h as unknown as HomestayRoomsData} />
        : <AmenitiesTab hotel={{ id: h.id, property_amenities: h.property_amenities as HotelAmenitiesInfo["property_amenities"], property_sub_type: h.property_sub_type }} />
    ) : currentTab === 4 ? (
      <PhotosTab hotelId={h.id} categories={photoCategories} propertySubType={h.property_sub_type} />
    ) : currentTab === 5 ? (
      <PoliciesTab hotel={h as unknown as PoliciesHotelData} />
    ) : currentTab === 6 ? (
      <FinanceTab hotel={h as unknown as FinanceHotelData} />
    ) : (
      <TabPlaceholder tabIndex={currentTab} tabLabel={tabLabel} />
    );

  return (
    <WizardShell
      hotel={h}
      currentTab={currentTab}
      tabFormId={tabFormId}
      effectiveWizardStep={effectiveWizardStep()}
      hideNextButton={hideNextButton}
    >
      {tabContent}
    </WizardShell>
  );
}
