import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../../components/ConnectHeader";
import { getRoomRateDetail } from "./rate-actions";
import ManageRatesClient from "./ManageRatesClient";

export default async function ManageRatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roomId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id, roomId: roomIdStr } = await params;
  const { from, to } = await searchParams;
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
    select: { id: true, name: true },
  });
  if (!room) notFound();

  const hasRange = !!(from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));
  const initialDetail = hasRange
    ? (await getRoomRateDetail(hotelId, roomId, from!, to!)).detail ?? null
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
            initialFrom={hasRange ? from! : null}
            initialTo={hasRange ? to! : null}
            initialDetail={initialDetail}
          />
        </div>
      </div>
    </>
  );
}
