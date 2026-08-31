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
  "/dashboard/hotel-inventory",
  "/dashboard/expiring-rates",
  "/dashboard/hotel-approvals",
  "/dashboard/property-submissions",
  "/dashboard/hotel-owners",
  "/dashboard/hotels/meal-types",
  "/dashboard/hotels/diet-types",
  "/dashboard/verify-hotels",
  "/dashboard/hotel-requests",
  "/dashboard/hotel-requests-v2",
  "/dashboard/hotel-requests-v2/catalog",
  "/dashboard/hotel-bookings",
  // Packages
  "/dashboard/packages",
  "/dashboard/package-bookings",
  // Cab Management
  "/dashboard/vehicles",
  "/dashboard/cab-pricing",
  "/dashboard/cab-inventory",
  "/dashboard/permits",
  "/dashboard/cab-drivers",
  "/dashboard/verify-cabs",
  "/dashboard/assign-driver",
  // Marketing
  "/dashboard/queries",
  "/dashboard/lead-report",
  "/dashboard/landing-pages",
  "/dashboard/email-marketing",
  "/dashboard/follow-ups",
  "/dashboard/references",
  "/dashboard/coupons",
  "/dashboard/reviews",
  "/dashboard/not-found",
  // Sales
  "/sales-dashboard",
  "/dashboard/sales-query",
  "/dashboard/request-lead",
  "/dashboard/lead-requests",
  "/dashboard/package-library",
  "/dashboard/package-builder",
  "/dashboard/verify-packages",
  "/dashboard/my-bookings",
  "/dashboard/cab-directory",
  // Transactions
  "/dashboard/transactions",
  "/dashboard/failed-transactions",
  "/dashboard/refunds",
  // Our Team
  "/dashboard/team-members",
  "/dashboard/activity-logs",
  "/dashboard/departments",
  "/dashboard/roles-and-permissions",
  // Booking Management
  "/dashboard/upcoming-guests",
  "/dashboard/manual-documents",
  // Settings
  "/dashboard/settings",
  "/dashboard/itinerary-settings",
];

// Resolve a request pathname to the sidebar href that governs access to it.
// Exact matches win (e.g. "/dashboard/hotels/meal-types" is its own entry);
// otherwise the longest href the pathname is nested under wins (e.g.
// "/dashboard/hotels/123" -> "/dashboard/hotels"). Returns null for
// pathnames not covered by any sidebar entry — those are always allowed.
export function resolveNavHref(pathname: string): string | null {
  if (ALL_HREFS.includes(pathname)) return pathname;

  // The review route is the exception, and it matters: it is costing's screen,
  // not an exec's. A Costing Manager is granted Verify Packages and NOT
  // Package Builder, so sending /review to the builder's key locked the
  // reviewers out of their own review — which is exactly what happened the
  // first time this alias shipped.
  if (pathname.startsWith("/dashboard/package-builder")) {
    return pathname.endsWith("/review")
      ? "/dashboard/verify-packages"
      : "/dashboard/package-builder";
  }

  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (href === "/dashboard") continue;
    if (pathname.startsWith(href + "/") && (!best || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
