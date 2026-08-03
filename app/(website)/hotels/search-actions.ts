"use server";

import {
  searchHotels,
  HOTELS_PAGE_SIZE,
  type HotelSearchPage,
  type HotelSearchOpts,
} from "./[slug]/booking-data";

/** The criteria half of a search — everything except which page of it. */
export type HotelSearchCriteria = Omit<HotelSearchOpts, "page" | "pageSize">;

/**
 * Client-callable wrapper for the listing's infinite scroll. `booking-data.ts`
 * is `server-only` (it's imported by server components), so the list component
 * can't reach `searchHotels` directly — this is the action boundary.
 *
 * The criteria are re-sent with every page rather than held server-side, so
 * page 2 is scoped exactly like page 1.
 */
export async function fetchHotelsPage(
  criteria: HotelSearchCriteria,
  page: number,
  pageSize: number = HOTELS_PAGE_SIZE,
): Promise<HotelSearchPage> {
  return searchHotels({ ...criteria, page, pageSize });
}
