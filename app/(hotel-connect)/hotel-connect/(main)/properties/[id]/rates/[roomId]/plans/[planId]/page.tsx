import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../../../../components/ConnectHeader";
import PlanFormClient, { type PlanFormInitial } from "../PlanFormClient";
import type { CancellationPolicy } from "@/app/lib/hotel-inventory/cancellation";

export default async function EditRatePlanPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string; planId: string }>;
}) {
  const { id, roomId: roomIdStr, planId: planIdStr } = await params;
  const hotelId = parseInt(id, 10);
  const roomId = parseInt(roomIdStr, 10);
  const planId = parseInt(planIdStr, 10);
  if (isNaN(hotelId) || isNaN(roomId) || isNaN(planId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel_id: hotelId, is_active: true, hotel: { owner_id: ownerId } },
    select: { id: true },
  });
  if (!room) notFound();

  const plan = await db.hotel_room_pricing.findFirst({
    where: { id: planId, room_id: roomId },
    select: {
      id: true, plan_name: true, meal_type_id: true, diet_type_id: true,
      cancellation_policy: true, gst_percentage: true, price_per_night: true, is_active: true,
    },
  });
  if (!plan) notFound();

  const [mealTypes, dietTypes] = await Promise.all([
    db.meal_types.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.diet_types.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const initial: PlanFormInitial = {
    planId: plan.id,
    planName: plan.plan_name ?? "",
    mealTypeId: plan.meal_type_id,
    dietTypeId: plan.diet_type_id,
    cancellationPolicy: plan.cancellation_policy as CancellationPolicy | null,
    gstPercentage: Number(plan.gst_percentage),
    basePrice: Number(plan.price_per_night),
    isActive: plan.is_active,
  };

  return (
    <>
      <ConnectHeader title="Edit Rate Plan" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-2xl">
          <PlanFormClient
            hotelId={hotelId}
            roomId={roomId}
            mealTypes={mealTypes}
            dietTypes={dietTypes}
            initial={initial}
          />
        </div>
      </div>
    </>
  );
}
