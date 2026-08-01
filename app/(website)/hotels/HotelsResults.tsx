import { searchHotels, type HotelSearchScope } from "./[slug]/booking-data";
import { hotelFiltersKey, type HotelFilters } from "@/app/lib/hotels/hotelFacets";
import HotelsList from "./HotelsList";

/**
 * Server half of the results column: runs the first page of the search inside
 * its own Suspense boundary so a filter change re-suspends only the list,
 * leaving the search bar and sidebar interactive.
 */
export default async function HotelsResults({
  scope,
  filters,
  city,
  stayQs,
}: {
  scope: HotelSearchScope;
  filters: HotelFilters;
  city: string;
  stayQs: string;
}) {
  const search = { ...scope, filters };
  const firstPage = await searchHotels(search);

  // Remount the list whenever *any* input to the result set changes — place as
  // well as filters. The Suspense boundary above is keyed on filters only, so
  // without this a new city would hand fresh props to a mounted list that is
  // still holding the previous city's scrolled-in pages.
  const listKey = [
    scope.query ?? "", scope.locationId ?? "", scope.locationType ?? "",
    hotelFiltersKey(filters),
  ].join("|");

  return (
    <>
      <p className="text-sm text-neutral-500 mb-6">
        {firstPage.total.toLocaleString("en-IN")}{" "}
        {firstPage.total === 1 ? "property" : "properties"}
        {city ? ` in ${city}` : ""}
      </p>

      <HotelsList key={listKey} initial={firstPage} search={search} city={city} stayQs={stayQs} />
    </>
  );
}
