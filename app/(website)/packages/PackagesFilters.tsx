import { fetchPackageSearchFacets } from "@/app/actions/search/package-facets";
import type { PackageFilters } from "@/app/lib/packages/packageFacets";
import PackagesFilterSidebar from "./PackagesFilterSidebar";

/**
 * Server half of the filter sidebar: resolves the facet counts for the current
 * search scope, then hands them to the client sidebar. Kept separate from the
 * page so the facet queries can stream in their own Suspense boundary rather
 * than holding up the search bar and results.
 */
export default async function PackagesFilters({
  to,
  filters,
}: {
  to: string;
  filters: PackageFilters;
}) {
  const facets = await fetchPackageSearchFacets(to || undefined);

  if (facets.total === 0) return null;

  return <PackagesFilterSidebar facets={facets} initialFilters={filters} />;
}

export { FilterPanelSkeleton as FiltersSkeleton } from "@/app/components/filters/FilterPanel";
