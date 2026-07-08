import { notFound, redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell from "../../WizardShell";
import SpaceEditTab from "./SpaceEditTab";
import type { SpaceItem } from "../../tabs/homestay-rooms-types";

export default async function SpaceEditPage({
  params,
}: {
  params: Promise<{ id: string; i: string }>;
}) {
  const { id, i: iStr } = await params;
  const hotelId = parseInt(id, 10);
  const idx = parseInt(iStr, 10);
  if (isNaN(hotelId) || isNaN(idx) || idx < 0) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true, name: true, slug: true, listing_status: true, rejection_reason: true, wizard_step: true,
      property_category: true, property_sub_type: true,
      hs_space_items: true,
    },
  });
  if (!hotel) notFound();
  if (hotel.property_category !== "HOMESTAY_VILLA")
    redirect(`/hotel-connect/properties/${hotelId}/edit?tab=3`);

  const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
  const item = items[idx];
  if (!item) notFound();

  return (
    <WizardShell
      hotel={hotel}
      currentTab={4}
      tabFormId={undefined}
      effectiveWizardStep={Math.max(hotel.wizard_step, 2)}
      hideNextButton={true}
    >
      <SpaceEditTab hotelId={hotelId} idx={idx} item={item} />
    </WizardShell>
  );
}
