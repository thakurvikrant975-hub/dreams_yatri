import { notFound, redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell from "../WizardShell";
import KitchenEditTab from "./KitchenEditTab";
import type { KitchenDetail } from "../tabs/homestay-rooms-types";

export default async function KitchenEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotelId = parseInt(id, 10);
  if (isNaN(hotelId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true, name: true, slug: true, listing_status: true, rejection_reason: true, wizard_step: true,
      property_category: true, property_sub_type: true,
      hs_kitchen_details: true,
    },
  });
  if (!hotel) notFound();
  if (hotel.property_category !== "HOMESTAY_VILLA")
    redirect(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
  if (!hotel.hs_kitchen_details)
    redirect(`/hotel-connect/properties/${hotelId}/edit?tab=4`);

  const detail = hotel.hs_kitchen_details as KitchenDetail;

  return (
    <WizardShell
      hotel={hotel}
      currentTab={4}
      tabFormId={undefined}
      effectiveWizardStep={Math.max(hotel.wizard_step, 2)}
      hideNextButton={true}
    >
      <KitchenEditTab hotelId={hotelId} detail={detail} />
    </WizardShell>
  );
}
