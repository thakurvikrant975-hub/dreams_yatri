"use server";

import { dashboardSignOut } from "./auth-dashboard";

export async function signOutEmployee() {
  await dashboardSignOut({ redirectTo: "/dashboard/login" });
}