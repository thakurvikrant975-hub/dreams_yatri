import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../../../../components/ConnectHeader";
import PlanFormClient from "../PlanFormClient";

export default async function NewRatePlanPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId: roomIdStr } = await params;
  const hotelId = parseInt(id, 10);
  const roomId = parseInt(roomIdStr, 10);
  if (isNaN(hotelId) || isNaN(roomId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel_id: hotelId, is_active: true, hotel: { owner_id: ownerId } },
    select: { id: true },
  });
  if (!room) notFound();

  const [mealTypes, dietTypes] = await Promise.all([
    db.meal_types.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.diet_types.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <ConnectHeader title="Add Rate Plan" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-2xl">
          <PlanFormClient
            hotelId={hotelId}
            roomId={roomId}
            mealTypes={mealTypes}
            dietTypes={dietTypes}
            initial={null}
          />
        </div>
      </div>
    </>
  );
}
