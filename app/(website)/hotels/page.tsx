import { Suspense } from "react";
import type { Metadata } from "next";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import type { LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { parseHotelFilters, hotelFiltersKey } from "@/app/lib/hotels/hotelFacets";
import { readRoomGuests } from "@/app/lib/packages/roomGuests";
import HotelsSearchBar from "./HotelsSearchBar";
import HotelsResults from "./HotelsResults";
import HotelsFilters, { FiltersSkeleton } from "./HotelsFilters";

export const metadata: Metadata = {
  title: "Hotels | Dreams Yatri",
  description: "Search and book hotels, homestays and resorts across India.",
};

function ResultsSkeleton() {
  return (
    <>
      <div className="skeleton-box h-5 w-40 rounded mb-6" />
      <div className="flex flex-col gap-4 sm:gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-neutral-100 flex">
            <div className="skeleton-box h-36 w-64 shrink-0" />
            <div className="flex-1 p-5 space-y-3">
              <div className="skeleton-box h-5 w-1/2 rounded" />
              <div className="skeleton-box h-4 w-1/3 rounded" />
              <div className="skeleton-box h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function pick(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

function toDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Rehydrate the picker from the URL. `locType` is echoed back so a state or
 * region survives a reload/share as itself — defaulting it to CITY would
 * quietly re-scope a "Kerala" search to a city named Kerala on the next search.
 */
function cityValue(city: string, locId: string, locType: string): LocationValue | null {
  if (!city) return null;
  return {
    id: locId || city,
    name: city,
    type: (locType || "CITY") as LocationType,
    breadcrumb: city,
    slug: "",
  };
}

export default async function HotelsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const city = pick(sp.city);
  const locId = pick(sp.locId);
  const locType = pick(sp.locType);
  const inISO = pick(sp.in);
  const outISO = pick(sp.out);
  // `pax` carries the real per-room split; the flat adults/children/rooms trio
  // is the fallback for links written before it existed.
  const roomGuests = readRoomGuests((key) => pick(sp[key]));

  const scope = {
    query: city || undefined,
    locationId: locId || undefined,
    locationType: locType || undefined,
  };
  const filters = parseHotelFilters((key) => pick(sp[key]));
  const stayQs = new URLSearchParams({
    ...(inISO ? { in: inISO } : {}),
    ...(outISO ? { out: outISO } : {}),
  }).toString();

  return (
    <>
      <Header />

      <HotelsSearchBar
        initialCity={cityValue(city, locId, locType)}
        initialCheckIn={toDate(inISO)}
        initialCheckOut={toDate(outISO)}
        initialRoomGuests={roomGuests}
      />

      <div className="screen-space py-8 pb-24 lg:pb-8">
        <div className="flex gap-7">
          <Suspense fallback={<FiltersSkeleton sections={4} />}>
            <HotelsFilters scope={scope} filters={filters} />
          </Suspense>

          <div className="flex-1 min-w-0">
            {/* Re-keyed on the filter selection so changing a filter re-suspends
                and shows the skeleton instead of leaving stale rows on screen. */}
            <Suspense key={hotelFiltersKey(filters)} fallback={<ResultsSkeleton />}>
              <HotelsResults scope={scope} filters={filters} city={city} stayQs={stayQs} />
            </Suspense>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
