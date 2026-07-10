import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../../components/ConnectHeader";
import { getRoomRateDetail } from "./rate-actions";
import ManageRatesClient, { type RatePlanOption } from "./ManageRatesClient";

export default async function ManageRatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roomId: string }>;
  searchParams: Promise<{ from?: string; to?: string; plan?: string }>;
}) {
  const { id, roomId: roomIdStr } = await params;
  const { from, to, plan } = await searchParams;
  const hotelId = parseInt(id, 10);
  const roomId = parseInt(roomIdStr, 10);
  if (isNaN(hotelId) || isNaN(roomId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, name: true },
  });
  if (!hotel) notFound();

  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel_id: hotelId, is_active: true },
    select: {
      id: true, name: true, max_adults: true,
      pricing: {
        orderBy: { sort_order: "asc" },
        select: { id: true, plan_name: true, is_active: true, meal_type: { select: { name: true } } },
      },
    },
  });
  if (!room) notFound();
  if (room.pricing.length === 0) notFound();

  const plans: RatePlanOption[] = room.pricing.map((p) => ({
    id: p.id,
    label: p.plan_name || p.meal_type?.name || "Room Only",
  }));

  // Default to the first active plan (or the first plan at all, if somehow
  // none are active) whenever ?plan= is missing/invalid — keeps every
  // pre-existing bookmarked URL working exactly as before this screen became
  // per-plan.
  const requestedPlanId = plan ? parseInt(plan, 10) : NaN;
  const requestedPlan = !isNaN(requestedPlanId) ? room.pricing.find((p) => p.id === requestedPlanId) : undefined;
  const pricingId = requestedPlan?.id
    ?? room.pricing.find((p) => p.is_active)?.id
    ?? room.pricing[0].id;

  const hasRange = !!(from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));
  const initialDetail = hasRange
    ? (await getRoomRateDetail(hotelId, roomId, pricingId, from!, to!)).detail ?? null
    : null;

  return (
    <>
      <ConnectHeader title="Manage All Rates" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-2xl">
          <ManageRatesClient
            hotelId={hotel.id}
            roomId={room.id}
            roomName={room.name}
            pricingId={pricingId}
            plans={plans}
            maxAdults={room.max_adults}
            initialFrom={hasRange ? from! : null}
            initialTo={hasRange ? to! : null}
            initialDetail={initialDetail}
          />
        </div>
      </div>
    </>
  );
}
