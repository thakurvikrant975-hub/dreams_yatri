import { notFound, redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell from "../../WizardShell";
import BathroomEditTab from "./BathroomEditTab";
import type { BathroomDetail } from "../../tabs/homestay-rooms-types";
import type { BedroomDetail } from "../../bedroom/[n]/bedroom-types";

export default async function BathroomEditPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n: nStr } = await params;
  const hotelId = parseInt(id, 10);
  const n = parseInt(nStr, 10);
  if (isNaN(hotelId) || isNaN(n) || n < 1) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true, name: true, slug: true, listing_status: true, wizard_step: true,
      property_category: true, property_sub_type: true,
      hs_bathrooms: true, hs_bathroom_details: true, hs_bedroom_details: true,
    },
  });
  if (!hotel) notFound();
  if (hotel.property_category !== "HOMESTAY_VILLA")
    redirect(`/hotel-connect/properties/${hotelId}/edit?tab=3`);

  const details = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
  if (n > details.length) notFound();
  const detail = details[n - 1];

  // Derive which bedroom this bathroom is attached to (1-to-1 by index)
  const bedrooms = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const attachedBedroom = bedrooms[n - 1] ?? null;

  return (
    <WizardShell
      hotel={hotel}
      currentTab={3}
      tabFormId={undefined}
      effectiveWizardStep={Math.max(hotel.wizard_step, 2)}
      hideNextButton={true}
    >
      <BathroomEditTab
        hotelId={hotelId}
        n={n}
        total={details.length}
        detail={detail}
        attachedBedroomName={attachedBedroom?.name ?? null}
      />
    </WizardShell>
  );
}
