import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { getRoomARI } from "@/app/lib/hotel-inventory/rates";
import { ensureHomestayRoom } from "@/app/lib/hotel-inventory/homestay-room-sync";
import ConnectHeader from "../../../components/ConnectHeader";
import CalendarClient from "./CalendarClient";

function yearBounds(year: number) {
  return { from: `${year}-01-01`, toExclusive: `${year + 1}-01-01` };
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { id } = await params;
  const { room: roomParam } = await searchParams;
  const hotelId = parseInt(id, 10);
  if (isNaN(hotelId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotelCheck = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { property_category: true },
  });
  if (!hotelCheck) notFound();

  // See rates/page.tsx for why this is needed — homestays only get a
  // hotel_rooms row from the wizard at Submit for Review otherwise.
  if (hotelCheck.property_category === "HOMESTAY_VILLA") {
    await ensureHomestayRoom(hotelId);
  }

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true,
      name: true,
      hotelRooms: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, name: true, num_rooms: true,
          pricing: {
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
            select: { id: true, plan_name: true, meal_type: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!hotel) notFound();

  const rooms = hotel.hotelRooms.map((r) => ({
    id: r.id,
    name: r.name,
    num_rooms: r.num_rooms,
    plans: r.pricing.map((p) => ({ id: p.id, label: p.plan_name || p.meal_type?.name || "Room Only" })),
  }));

  const year = new Date().getUTCFullYear();
  const { from, toExclusive } = yearBounds(year);

  const requestedRoomId = roomParam ? parseInt(roomParam, 10) : NaN;
  const requestedRoom = !isNaN(requestedRoomId)
    ? rooms.find((r) => r.id === requestedRoomId) ?? null
    : null;
  const firstRoom = requestedRoom ?? rooms[0] ?? null;
  const firstPlanId = firstRoom?.plans[0]?.id ?? null;
  const initialDays = firstRoom ? await getRoomARI(firstRoom.id, from, toExclusive, undefined, firstPlanId ?? undefined) : [];

  return (
    <>
      <ConnectHeader title="Rates & Availability" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-5xl">
          <CalendarClient
            hotelId={hotel.id}
            hotelName={hotel.name}
            rooms={rooms}
            initialRoomId={firstRoom?.id ?? null}
            initialPlanId={firstPlanId}
            initialYear={year}
            initialDays={initialDays}
          />
        </div>
      </div>
    </>
  );
}
