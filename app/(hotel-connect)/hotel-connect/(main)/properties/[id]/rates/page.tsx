import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { ensureHomestayRoom } from "@/app/lib/hotel-inventory/homestay-room-sync";
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
    select: { id: true, name: true, property_category: true },
  });
  if (!hotel) notFound();

  // Homestays never get a hotel_rooms row from the wizard itself — it's
  // normally provisioned at Submit for Review. An owner should be able to
  // set rates/availability while still editing, so lazily ensure it here
  // too. Idempotent and a no-op until the wizard's pricing step is done
  // (ensureHomestayRoom requires prop_base_rate to be set).
  if (hotel.property_category === "HOMESTAY_VILLA") {
    await ensureHomestayRoom(hotelId);
  }

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
        orderBy: { sort_order: "asc" },
        select: { id: true, plan_name: true, price_per_night: true, is_active: true, meal_type: { select: { name: true } } },
      },
    },
  });

  const roomItems: RoomListItem[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    numRooms: r.num_rooms,
    isBookable: r.is_bookable,
    thumbnail: r.images[0]?.thumbnail ?? r.images[0]?.url ?? null,
    ratePlans: r.pricing.map((p) => ({
      id: p.id,
      label: p.plan_name || p.meal_type?.name || "Room Only",
      price: Number(p.price_per_night),
      isActive: p.is_active,
    })),
  }));

  return (
    <>
      <ConnectHeader title="Rates & Availability" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-5xl">
          <RoomListClient
            hotelId={hotel.id}
            hotelName={hotel.name}
            rooms={roomItems}
            isHomestay={hotel.property_category === "HOMESTAY_VILLA"}
          />
        </div>
      </div>
    </>
  );
}
