import { fetchHotelSearchFacets } from "./facets-actions";
import type { HotelSearchScope } from "./[slug]/booking-data";
import type { HotelFilters } from "@/app/lib/hotels/hotelFacets";
import HotelsFilterSidebar from "./HotelsFilterSidebar";

/**
 * Server half of the filter sidebar: resolves the facet counts for the current
 * search scope, then hands them to the client sidebar. Kept separate from the
 * page so the facet queries can stream in their own Suspense boundary rather
 * than holding up the search bar and results.
 */
export default async function HotelsFilters({
  scope,
  filters,
}: {
  scope: HotelSearchScope;
  filters: HotelFilters;
}) {
  const facets = await fetchHotelSearchFacets(scope);

  if (facets.total === 0) return null;

  return <HotelsFilterSidebar facets={facets} initialFilters={filters} />;
}

export { FilterPanelSkeleton as FiltersSkeleton } from "@/app/components/filters/FilterPanel";
