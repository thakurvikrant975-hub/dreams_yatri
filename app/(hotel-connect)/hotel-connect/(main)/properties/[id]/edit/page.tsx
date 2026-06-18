import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell, { WIZARD_TABS } from "./WizardShell";
import BasicInfoTab from "./tabs/BasicInfoTab";
import TabPlaceholder from "./tabs/TabPlaceholder";

// Tabs that have a real form (form id = "wizard-form"); grows with each phase.
const TABS_WITH_FORM = new Set([1]);

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
    },
  });
  if (!hotel) notFound();

  const currentTab = Math.max(1, Math.min(7, parseInt(tab ?? "1", 10) || 1));
  const tabLabel   = WIZARD_TABS[currentTab - 1]?.label ?? "";
  const tabFormId  = TABS_WITH_FORM.has(currentTab) ? "wizard-form" : undefined;

  const tabContent =
    currentTab === 1 ? (
      <BasicInfoTab hotel={hotel} />
    ) : (
      <TabPlaceholder tabIndex={currentTab} tabLabel={tabLabel} />
    );

  return (
    <WizardShell
      hotel={hotel}
      currentTab={currentTab}
      tabFormId={tabFormId}
    >
      {tabContent}
    </WizardShell>
  );
}
