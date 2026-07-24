"use server";

import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";

/** The guest's own most recent paid booking at this hotel, if any — used to
 * show a "Message Host" entry point on the public hotel page only for guests
 * who've actually booked (and paid), same gating as the chat itself. Returns
 * null (button hidden) for anonymous visitors or unpaid/abandoned checkouts.
 * The paymentStatus allow-list mirrors app/lib/messaging.ts's isPaidStatus. */
export async function getMyPaidBookingAtHotel(hotelId: number): Promise<string | null> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return null;

  const stay = await db.bookingHotel.findFirst({
    where: {
      hotelId,
      booking: { userId: user.id, paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] } },
    },
    orderBy: { id: "desc" },
    select: { bookingId: true },
  });

  return stay?.bookingId ?? null;
}
