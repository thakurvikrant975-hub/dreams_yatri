"use server";

import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { createReservation } from "@/app/lib/hotel-inventory/reservations";
import { getStayQuote } from "@/app/lib/hotel-inventory/rates";

/**
 * Hold a room reservation from the guest booking form. Creates a HELD reservation
 * (real inventory decrement via the engine). Payment/confirmation is a follow-up —
 * for now the guest gets a held booking they can pay for at the property.
 */
export async function holdRoomReservation(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const roomId = Number(formData.get("roomId"));
  const checkIn = String(formData.get("checkIn") ?? "");
  const checkOut = String(formData.get("checkOut") ?? "");
  const units = Math.max(1, Number(formData.get("units") ?? 1));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel: { slug } },
    select: { id: true },
  });
  if (!room || !slug || !checkIn || !checkOut) redirect(`/hotels/${slug}`);

  const back = (msg: string) =>
    `/hotels/${slug}/book?room=${roomId}&in=${checkIn}&out=${checkOut}&error=${encodeURIComponent(msg)}`;

  if (!name || !email || !phone) redirect(back("Please fill in your name, email and phone."));

  // Server-authoritative price snapshot.
  const quote = await getStayQuote(roomId, checkIn, checkOut, undefined);
  if (!quote.allAvailable) redirect(back("Sorry, those dates are no longer available."));

  const res = await createReservation({
    roomId,
    checkIn,
    checkOut,
    units,
    holdKey: globalThis.crypto.randomUUID(),
    source: "direct",
    status: "HELD",
    guest: { name, email, phone },
    money: quote.total != null ? { currency: "INR", gross: quote.total } : undefined,
  });

  if (!res.ok) redirect(back(res.reason));
  redirect(`/hotels/${slug}/booked/${res.reservation.id}`);
}
