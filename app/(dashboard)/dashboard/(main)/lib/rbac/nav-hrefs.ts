// app/(dashboard)/dashboard/(main)/lib/rbac/nav-hrefs.ts
//
// Plain list of every sidebar href — no icon imports, so this is safe to
// import from Server Components (e.g. the dashboard layout, for server-side
// page-access enforcement). This MUST mirror the hrefs in NAV_GROUPS
// (nav-items.ts) — update both when adding/removing/renaming a sidebar entry.

export const ALL_HREFS = [
  // Overview
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/reports",
  "/dashboard/locations",
  // Content Management
  "/dashboard/regions",
  "/dashboard/destinations",
  "/dashboard/categories",
  "/dashboard/policies",
  "/dashboard/blogs",
  // Activities
  "/dashboard/activities",
  "/dashboard/activities/categories",
  // Hotels
  "/dashboard/hotels",
  "/dashboard/hotels/overview",
  "/dashboard/property-submissions",
  "/dashboard/hotels/meal-types",
  "/dashboard/hotels/diet-types",
  "/dashboard/verify-hotels",
  // Packages
  "/dashboard/packages",
  "/dashboard/package-bookings",
  // Cab Management
  "/dashboard/vehicles",
  "/dashboard/cab-pricing",
  "/dashboard/permits",
  "/dashboard/cab-drivers",
  "/dashboard/verify-cabs",
  "/dashboard/assign-driver",
  // Marketing
  "/dashboard/queries",
  "/dashboard/email-marketing",
  "/dashboard/follow-ups",
  "/dashboard/references",
  "/dashboard/coupons",
  "/dashboard/reviews",
  "/dashboard/not-found",
  // Sales
  "/sales-dashboard",
  "/dashboard/sales-query",
  "/dashboard/package-library",
  "/dashboard/package-builder",
  // Transactions
  "/dashboard/transactions",
  "/dashboard/failed-transactions",
  "/dashboard/refunds",
  // Our Team
  "/dashboard/team-members",
  "/dashboard/activity-logs",
  "/dashboard/departments",
  "/dashboard/roles-and-permissions",
  // Settings
  "/dashboard/settings",
];

// Resolve a request pathname to the sidebar href that governs access to it.
// Exact matches win (e.g. "/dashboard/hotels/meal-types" is its own entry);
// otherwise the longest href the pathname is nested under wins (e.g.
// "/dashboard/hotels/123" -> "/dashboard/hotels"). Returns null for
// pathnames not covered by any sidebar entry — those are always allowed.
export function resolveNavHref(pathname: string): string | null {
  if (ALL_HREFS.includes(pathname)) return pathname;

  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (href === "/dashboard") continue;
    if (pathname.startsWith(href + "/") && (!best || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
