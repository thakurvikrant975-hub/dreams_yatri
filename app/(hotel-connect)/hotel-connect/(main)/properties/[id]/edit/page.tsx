import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell, { WIZARD_TABS } from "./WizardShell";
import BasicInfoTab from "./tabs/BasicInfoTab";
import LocationTab from "./tabs/LocationTab";
import AmenitiesTab, { type HotelAmenitiesInfo } from "./tabs/AmenitiesTab";
import RoomsTab, { type RoomSummary } from "./tabs/RoomsTab";
import PhotosTab, { type PhotoCategory } from "./tabs/PhotosTab";
import PoliciesTab, { type PoliciesHotelData } from "./tabs/PoliciesTab";
import FinanceTab, { type FinanceHotelData } from "./tabs/FinanceTab";
import TabPlaceholder from "./tabs/TabPlaceholder";

// Tabs that have a real form (form id = "wizard-form"); grows with each phase.
// Tab 4 (Rooms) manages its own internal form — excluded intentionally.
const TABS_WITH_FORM = new Set([1, 2, 3, 6, 7]);

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

  // Prisma returns Decimal objects for latitude/longitude — not serializable to
  // Client Components. Convert once here so every usage below is plain numbers.
  const h = {
    ...hotel,
    latitude:  hotel.latitude  != null ? Number(hotel.latitude)  : null,
    longitude: hotel.longitude != null ? Number(hotel.longitude) : null,
  };

  const rooms = hotel.hotelRooms as RoomSummary[];

  // Compute how far the wizard is ACTUALLY complete based on saved DB data.
  // wizard_step tracks the last step saved, but a past save may have had
  // incomplete data (e.g. geocoding miss). This caps access to only tabs whose
  // required fields are genuinely present in the DB.
  function effectiveWizardStep(): number {
    // Tab 1 — Basic Info: property category is the minimum gate
    if (!h.property_category) return 0;
    // Tab 2 — Location: all required location fields must be present
    if (
      !h.address ||
      !h.city ||
      !h.state ||
      !h.country ||
      !h.pincode ||
      h.latitude == null
    ) return 1;
    // Tab 4 — Rooms: need at least one room
    if (rooms.length === 0) return 3;
    // Tab 5 — Photos: completed once at least one photo is uploaded
    if (h._count.images === 0) return 4;
    return Math.max(h.wizard_step, 5);
  }

  const currentTab = Math.max(1, Math.min(7, parseInt(tab ?? "1", 10) || 1));

  // Fetch photos only when on Tab 5 to avoid unnecessary queries
  let photoCategories: PhotoCategory[] = [];
  if (currentTab === 5) {
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
  const tabLabel   = WIZARD_TABS[currentTab - 1]?.label ?? "";
  const tabFormId  = TABS_WITH_FORM.has(currentTab) ? "wizard-form" : undefined;

  const tabContent =
    currentTab === 1 ? (
      <BasicInfoTab hotel={h} />
    ) : currentTab === 2 ? (
      <LocationTab hotel={h} />
    ) : currentTab === 3 ? (
      <AmenitiesTab hotel={{ id: h.id, property_amenities: h.property_amenities as HotelAmenitiesInfo["property_amenities"] }} />
    ) : currentTab === 4 ? (
      <RoomsTab hotelId={h.id} rooms={rooms} />
    ) : currentTab === 5 ? (
      <PhotosTab hotelId={h.id} categories={photoCategories} />
    ) : currentTab === 6 ? (
      <PoliciesTab hotel={h as unknown as PoliciesHotelData} />
    ) : currentTab === 7 ? (
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
    >
      {tabContent}
    </WizardShell>
  );
}
