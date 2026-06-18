"use server";

import { hotelConnectSignOut } from "./auth-hotel-connect";

export async function signOutHotelOwner() {
  await hotelConnectSignOut({ redirectTo: "/hotel-connect/login" });
}
