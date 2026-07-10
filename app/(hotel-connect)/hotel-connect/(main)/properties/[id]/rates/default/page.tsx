import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../../components/ConnectHeader";
import DefaultRatesClient, { type RoomDefaultData } from "./DefaultRatesClient";

export default async function DefaultRatesPage({ params }: { params: Promise<{ id: string }> }) {
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
      id: true, name: true, num_rooms: true, max_adults: true,
      pricing: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, plan_name: true, price_per_night: true,
          extra_bed_rate: true, extra_child_rate: true,
          meal_type: { select: { name: true } },
          occupancy_prices: { select: { occupancy: true, price_per_night: true } },
        },
      },
    },
  });

  const roomData: RoomDefaultData[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    numRooms: r.num_rooms,
    maxAdults: r.max_adults,
    plans: r.pricing.map((p) => ({
      id: p.id,
      label: p.plan_name || p.meal_type?.name || "Room Only",
      detail: {
        basePrice: Number(p.price_per_night),
        occupancyPrices: Object.fromEntries(p.occupancy_prices.map((o) => [o.occupancy, Number(o.price_per_night)])),
        extraChildRate: p.extra_child_rate != null ? Number(p.extra_child_rate) : null,
        extraAdultRate: p.extra_bed_rate != null ? Number(p.extra_bed_rate) : null,
        maxAdults: r.max_adults,
      },
    })),
  }));

  return (
    <>
      <ConnectHeader title="Default Rates & Inventory" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-4xl">
          <DefaultRatesClient hotelId={hotel.id} hotelName={hotel.name} rooms={roomData} />
        </div>
      </div>
    </>
  );
}
