import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { getRoomARI } from "@/app/lib/hotel-inventory/rates";
import ConnectHeader from "../../../components/ConnectHeader";
import CalendarClient from "./CalendarClient";

function monthBounds(year: number, month0: number) {
  const from = new Date(Date.UTC(year, month0, 1)).toISOString().slice(0, 10);
  const toExclusive = new Date(Date.UTC(year, month0 + 1, 1)).toISOString().slice(0, 10);
  return { from, toExclusive };
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

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true,
      name: true,
      hotelRooms: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { id: true, name: true, num_rooms: true },
      },
    },
  });
  if (!hotel) notFound();

  const now = new Date();
  const year = now.getUTCFullYear();
  const month0 = now.getUTCMonth();
  const { from, toExclusive } = monthBounds(year, month0);

  const requestedRoomId = roomParam ? parseInt(roomParam, 10) : NaN;
  const requestedRoom = !isNaN(requestedRoomId)
    ? hotel.hotelRooms.find((r) => r.id === requestedRoomId) ?? null
    : null;
  const firstRoom = requestedRoom ?? hotel.hotelRooms[0] ?? null;
  const initialDays = firstRoom ? await getRoomARI(firstRoom.id, from, toExclusive) : [];

  return (
    <>
      <ConnectHeader title="Rates & Availability" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-5xl">
          <CalendarClient
            hotelId={hotel.id}
            hotelName={hotel.name}
            rooms={hotel.hotelRooms}
            initialRoomId={firstRoom?.id ?? null}
            initialYear={year}
            initialMonth0={month0}
            initialDays={initialDays}
          />
        </div>
      </div>
    </>
  );
}
