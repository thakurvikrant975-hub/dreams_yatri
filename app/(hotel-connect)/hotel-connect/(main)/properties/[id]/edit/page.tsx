import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell from "./WizardShell";
import { WIZARD_TABS, HOMESTAY_WIZARD_TABS } from "./wizard-tab-config";
import BasicInfoTab from "./tabs/BasicInfoTab";
import HomestayBasicInfoTab, { type HomestayBasicInfo } from "./tabs/HomestayBasicInfoTab";
import HomestayRoomsTab, { type HomestayRoomsData } from "./tabs/HomestayRoomsTab";
import type { OwnerProfile } from "./tabs/HostDetailsSection";
import LocationTab from "./tabs/LocationTab";
import AmenitiesTab, { type HotelAmenitiesInfo } from "./tabs/AmenitiesTab";
import RoomsTab, { type RoomSummary } from "./tabs/RoomsTab";
import PhotosTab, { type PhotoCategory } from "./tabs/PhotosTab";
import MealsPricingTab, { type MealsPricingHotelData } from "./tabs/MealsPricingTab";
import PoliciesTab, { type PoliciesHotelData } from "./tabs/PoliciesTab";
import HomestayPoliciesTab, { type HomestayPoliciesData } from "./tabs/HomestayPoliciesTab";
import FinanceTab, { type FinanceHotelData } from "./tabs/FinanceTab";
import HomestayFinanceTab, { type HomestayFinanceData } from "./tabs/HomestayFinanceTab";
import TabPlaceholder from "./tabs/TabPlaceholder";

// Hotels: tabs 1–3, 6–7 render a wizard-form; tab 4 (Rooms) self-manages; tab 5 (Photos) upload-only.
// Homestay: tabs 1–3, 6–8 render a wizard-form (tab 6=Pricing, 7=Policies, 8=Finance).
// TABS_WITH_FORM is resolved dynamically below after isHomestay is known.
const HOTEL_TABS_WITH_FORM    = new Set([1, 2, 3, 5, 6, 7]);
const HOMESTAY_TABS_WITH_FORM = new Set([1, 2, 3, 5, 6, 7, 8]);

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
      // pricing & availability fields
      prop_num_units:      true,
      prop_meal_option:    true,
      prop_base_occupancy: true,
      prop_max_adults:     true,
      prop_max_children:   true,
      prop_max_occupancy:  true,
      prop_avail_from:     true,
      prop_avail_to:       true,
      prop_base_rate:      true,
      prop_extra_adult:    true,
      prop_child_rate:     true,
      // policy fields (shared)
      check_in_time: true,
      check_out_time: true,
      cancellation_policy: true,
      // homestay-specific policy fields
      has_check_in_end_time:    true,
      check_in_end_time:        true,
      smoking_areas:            true,
      entry_exit_restrictions:  true,
      noise_policy:             true,
      pet_charge_amount:        true,
      pet_count:                true,
      food_kitchen_available:   true,
      caretaker_stays:          true,
      caretaker_details:        true,
      caretaker_availability:   true,
      caretaker_services:       true,
      caretaker_knowledge:      true,
      caretaker_helps_cleaning: true,
      self_checkin_smart_door:  true,
      host_greets_helps:        true,
      caretaker_greets_helps:   true,
      building_staff_keys:      true,
      custom_policy:            true,
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
      // finance fields (shared)
      bank_account_number: true,
      bank_ifsc_code: true,
      bank_name: true,
      bank_consent_given: true,
      gstin_number: true,
      pan_number: true,
      business_type: true,
      msme_number: true,
      property_documents: true,
      // homestay-specific finance fields
      ownership_type:        true,
      has_registration_doc:  true,
      relationship_doc_type: true,
      id_proof_type:         true,
      tan_number:            true,
      // rooms
      hotelRooms: {
        select: {
          id: true, name: true, room_type: true,
          num_rooms: true, num_bedrooms: true, is_active: true,
        },
        where:   { is_active: true },
        orderBy: { sort_order: "asc" },
      },
      // photo count — used to gate tab 5 completion tick
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

  // Prisma returns Decimal objects for lat/lng and pricing fields — convert to
  // plain primitives so they serialize across the RSC boundary.
  const h = {
    ...hotel,
    latitude:         hotel.latitude         != null ? Number(hotel.latitude)              : null,
    longitude:        hotel.longitude        != null ? Number(hotel.longitude)             : null,
    prop_base_rate:   hotel.prop_base_rate   != null ? hotel.prop_base_rate.toFixed(2)    : null,
    prop_extra_adult: hotel.prop_extra_adult != null ? hotel.prop_extra_adult.toFixed(2)  : null,
    prop_child_rate:  hotel.prop_child_rate  != null ? hotel.prop_child_rate.toFixed(2)   : null,
  };

  const rooms = hotel.hotelRooms as RoomSummary[];
  const isHomestay = h.property_category === "HOMESTAY_VILLA";
  // Hotels have 7 tabs (no Pricing tab); Homestay/Villa have 8 tabs (Pricing at tab 6)
  const maxTab = isHomestay ? 8 : 7;
  const TABS_WITH_FORM = isHomestay ? HOMESTAY_TABS_WITH_FORM : HOTEL_TABS_WITH_FORM;

  // Compute how far the wizard is ACTUALLY complete based on saved DB data.
  function effectiveWizardStep(): number {
    if (!h.property_category) return 0;
    if (
      !h.address || !h.city || !h.state ||
      !h.country || !h.pincode || h.latitude == null
    ) return 1;
    if (isHomestay) {
      // wizard_step < 4 means Rooms & Spaces (tab 4) not yet saved
      if (h.wizard_step < 4) return Math.min(h.wizard_step, 3);
      if (h._count.images === 0) return 4; // Photos = tab 5; no images → tabs 1-4 complete
      return Math.max(h.wizard_step, 5);
    }
    // Hotels: tab 4 = Rooms, tab 5 = Photos
    if (rooms.length === 0) return 3;
    if (h._count.images === 0) return 4;
    return Math.max(h.wizard_step, 5);
  }

  const currentTab = Math.max(1, Math.min(maxTab, parseInt(tab ?? "1", 10) || 1));

  // Both Homestay and Hotels now have Photos at tab 5
  const photosTab = 5;
  let photoCategories: PhotoCategory[] = [];
  if (currentTab === photosTab) {
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

  const wizardTabs = isHomestay ? HOMESTAY_WIZARD_TABS : WIZARD_TABS;
  const tabLabel   = wizardTabs.find(t => t.index === currentTab)?.label ?? "";

  // Homestay tab 4 = Rooms & Spaces: Phase 1 (counts not yet saved) hides footer button
  const isHomestayRoomsCountsPending = isHomestay && currentTab === 4 && h.hs_bedrooms == null;
  const tabFormId = !TABS_WITH_FORM.has(currentTab) ? undefined : "wizard-form";

  const pricingData: MealsPricingHotelData = {
    id:                  h.id,
    prop_num_units:      h.prop_num_units      ?? null,
    prop_meal_option:    h.prop_meal_option     ?? null,
    prop_base_occupancy: h.prop_base_occupancy  ?? null,
    prop_max_adults:     h.prop_max_adults      ?? null,
    prop_max_children:   h.prop_max_children    ?? null,
    prop_max_occupancy:  h.prop_max_occupancy   ?? null,
    prop_avail_from:     h.prop_avail_from      ?? null,
    prop_avail_to:       h.prop_avail_to        ?? null,
    prop_base_rate:      h.prop_base_rate       ?? null,
    prop_extra_adult:    h.prop_extra_adult      ?? null,
    prop_child_rate:     h.prop_child_rate       ?? null,
  };

  const tabContent = isHomestay ? (
    currentTab === 1 ? (
      <HomestayBasicInfoTab hotel={h as unknown as HomestayBasicInfo} owner={ownerRecord as unknown as OwnerProfile} />
    ) : currentTab === 2 ? (
      <LocationTab hotel={h} />
    ) : currentTab === 3 ? (
      <AmenitiesTab hotel={{ id: h.id, property_amenities: h.property_amenities as HotelAmenitiesInfo["property_amenities"], property_sub_type: h.property_sub_type }} />
    ) : currentTab === 4 ? (
      <HomestayRoomsTab hotel={h as unknown as HomestayRoomsData} />
    ) : currentTab === 5 ? (
      <PhotosTab hotelId={h.id} categories={photoCategories} propertySubType={h.property_sub_type} />
    ) : currentTab === 6 ? (
      <MealsPricingTab hotel={pricingData} />
    ) : currentTab === 7 ? (
      <HomestayPoliciesTab hotel={h as unknown as HomestayPoliciesData} />
    ) : currentTab === 8 ? (
      <HomestayFinanceTab hotel={h as unknown as HomestayFinanceData} />
    ) : (
      <TabPlaceholder tabIndex={currentTab} tabLabel={tabLabel} />
    )
  ) : (
    currentTab === 1 ? (
      <BasicInfoTab hotel={h} />
    ) : currentTab === 2 ? (
      <LocationTab hotel={h} />
    ) : currentTab === 3 ? (
      <AmenitiesTab hotel={{ id: h.id, property_amenities: h.property_amenities as HotelAmenitiesInfo["property_amenities"], property_sub_type: h.property_sub_type }} />
    ) : currentTab === 4 ? (
      <RoomsTab hotelId={h.id} rooms={rooms} propertySubType={h.property_sub_type} />
    ) : currentTab === 5 ? (
      <PhotosTab hotelId={h.id} categories={photoCategories} propertySubType={h.property_sub_type} />
    ) : currentTab === 6 ? (
      <PoliciesTab hotel={h as unknown as PoliciesHotelData} />
    ) : currentTab === 7 ? (
      <FinanceTab hotel={h as unknown as FinanceHotelData} />
    ) : (
      <TabPlaceholder tabIndex={currentTab} tabLabel={tabLabel} />
    )
  );

  return (
    <WizardShell
      hotel={h}
      currentTab={currentTab}
      tabFormId={tabFormId}
      effectiveWizardStep={effectiveWizardStep()}
      hideNextButton={isHomestayRoomsCountsPending}
    >
      {tabContent}
    </WizardShell>
  );
}
