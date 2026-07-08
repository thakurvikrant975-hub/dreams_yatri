import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../components/ConnectHeader";
import RoomListClient, { type RoomListItem } from "./RoomListClient";

export default async function RatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotelId = parseInt(id, 10);
  if (isNaN(hotelId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, name: true },
  });
  if (!hotel) notFound();

  const rooms = await db.hotel_rooms.findMany({
    where: { hotel_id: hotelId, is_active: true },
    orderBy: { sort_order: "asc" },
    select: {
      id: true,
      name: true,
      num_rooms: true,
      is_bookable: true,
      images: { where: { is_primary: true }, take: 1, select: { thumbnail: true, url: true } },
      pricing: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        take: 1,
        select: { price_per_night: true },
      },
    },
  });

  const roomItems: RoomListItem[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    numRooms: r.num_rooms,
    isBookable: r.is_bookable,
    thumbnail: r.images[0]?.thumbnail ?? r.images[0]?.url ?? null,
    baseRate: r.pricing[0]?.price_per_night != null ? Number(r.pricing[0].price_per_night) : null,
  }));

  return (
    <>
      <ConnectHeader title="Rates & Availability" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-5xl">
          <RoomListClient hotelId={hotel.id} hotelName={hotel.name} rooms={roomItems} />
        </div>
      </div>
    </>
  );
}
