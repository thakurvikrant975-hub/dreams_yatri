import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import WizardShell from "./WizardShell";

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
    },
  });
  if (!hotel) notFound();

  const currentTab = Math.max(1, Math.min(7, parseInt(tab ?? "1", 10) || 1));

  return <WizardShell hotel={hotel} currentTab={currentTab} />;
}
