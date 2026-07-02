import { notFound, redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell from "../../WizardShell";
import BedroomEditTab from "./BedroomEditTab";
import { defaultBedroom, type BedroomDetail } from "./bedroom-types";

export default async function BedroomEditPage({
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
      id: true, name: true, listing_status: true, wizard_step: true,
      property_category: true, property_sub_type: true,
      hs_bedrooms: true, hs_bedroom_details: true,
    },
  });
  if (!hotel) notFound();
  if (hotel.property_category !== "HOMESTAY_VILLA") redirect(`/hotel-connect/properties/${hotelId}/edit?tab=3`);

  const total = hotel.hs_bedrooms ?? 1;
  if (n > total) notFound();

  const details = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const detail: BedroomDetail = details[n - 1] ?? defaultBedroom(n);

  return (
    <WizardShell
      hotel={hotel}
      currentTab={3}
      tabFormId={undefined}
      effectiveWizardStep={Math.max(hotel.wizard_step, 2)}
      hideNextButton={true}
    >
      <BedroomEditTab
        hotelId={hotelId}
        n={n}
        total={total}
        detail={detail}
      />
    </WizardShell>
  );
}
