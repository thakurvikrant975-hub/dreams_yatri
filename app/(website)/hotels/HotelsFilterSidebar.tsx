"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FilterCheckRow,
  FilterDrawer,
  FilterPanel,
  FilterSection,
  FilterTrigger,
} from "@/app/components/filters/FilterPanel";
import type { HotelSearchFacets } from "./facets-actions";
import {
  EMPTY_HOTEL_FILTERS,
  applyHotelFilters,
  countActiveHotelFilters,
  type HotelFilters,
} from "@/app/lib/hotels/hotelFacets";

interface Props {
  facets: HotelSearchFacets;
  initialFilters: HotelFilters;
}

export default function HotelsFilterSidebar({ facets, initialFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [mobileOpen, setMobileOpen] = useState(false);

  // The URL is the source of truth, so a checkbox would otherwise stay unticked
  // until the server finished re-rendering the results. The optimistic copy
  // ticks it immediately and falls back to the server's own answer once the
  // transition settles — which also covers the back button and shared links.
  const [filters, applyOptimistic] = useOptimistic(initialFilters);

  function pushFilters(next: HotelFilters) {
    // Copy the current params rather than build a fresh set: the search bar's
    // own city/date/guest params live in the same query string.
    const params = applyHotelFilters(new URLSearchParams(searchParams.toString()), next);
    const qs = params.toString();
    startTransition(() => {
      applyOptimistic(next);
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    });
  }

  function toggle<K extends keyof HotelFilters>(key: K, value: HotelFilters[K][number]) {
    const current = filters[key] as (string | number)[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    pushFilters({ ...filters, [key]: next } as HotelFilters);
  }

  function clearSection(key: keyof HotelFilters) {
    pushFilters({ ...filters, [key]: [] } as HotelFilters);
  }

  const activeCount = countActiveHotelFilters(filters);

  // Options nothing in this scope could satisfy are dropped rather than shown
  // as dead "(0)" rows — with a catalogue this uneven, most places would
  // otherwise render a sidebar that is mostly zeroes.
  const stars = facets.stars.filter((s) => s.count > 0);
  const price = facets.price.filter((p) => p.count > 0);
  const roomTypes = facets.roomTypes.filter((r) => r.count > 0);
  const propertyTypes = facets.propertyTypes.filter((p) => p.count > 0);
  const mealPlans = facets.mealPlans.filter((m) => m.count > 0);
  const amenities = facets.amenities.filter((a) => a.count > 0);

  const filterContent = (
    <div className="space-y-6">
      {price.length > 0 && (
        <FilterSection
          title="Price"
          subtitle="Per night"
          selected={filters.price.length}
          onClear={() => clearSection("price")}
        >
          {price.map((b) => (
            <FilterCheckRow
              key={b.value}
              label={b.label}
              count={b.count}
              checked={filters.price.includes(b.value)}
              onChange={() => toggle("price", b.value)}
            />
          ))}
        </FilterSection>
      )}

      {stars.length > 0 && (
        <FilterSection
          title="Star Rating"
          selected={filters.stars.length}
          onClear={() => clearSection("stars")}
        >
          {stars.map((s) => (
            <FilterCheckRow
              key={s.value}
              label={s.label}
              count={s.count}
              checked={filters.stars.includes(s.value)}
              onChange={() => toggle("stars", s.value)}
            />
          ))}
        </FilterSection>
      )}

      {propertyTypes.length > 0 && (
        <FilterSection
          title="Property Type"
          selected={filters.propertyTypes.length}
          onClear={() => clearSection("propertyTypes")}
        >
          {propertyTypes.map((p) => (
            <FilterCheckRow
              key={p.value}
              label={p.label}
              count={p.count}
              checked={filters.propertyTypes.includes(p.value)}
              onChange={() => toggle("propertyTypes", p.value)}
            />
          ))}
        </FilterSection>
      )}

      {roomTypes.length > 0 && (
        <FilterSection
          title="Room Type"
          selected={filters.roomTypes.length}
          onClear={() => clearSection("roomTypes")}
        >
          {roomTypes.map((r) => (
            <FilterCheckRow
              key={r.value}
              label={r.label}
              count={r.count}
              checked={filters.roomTypes.includes(r.value)}
              onChange={() => toggle("roomTypes", r.value)}
            />
          ))}
        </FilterSection>
      )}

      {mealPlans.length > 0 && (
        <FilterSection
          title="Meal Plan"
          selected={filters.mealPlans.length}
          onClear={() => clearSection("mealPlans")}
        >
          {mealPlans.map((m) => (
            <FilterCheckRow
              key={m.value}
              label={m.label}
              hint={m.hint}
              count={m.count}
              checked={filters.mealPlans.includes(m.value)}
              onChange={() => toggle("mealPlans", m.value)}
            />
          ))}
        </FilterSection>
      )}

      {amenities.length > 0 && (
        <FilterSection
          title="Amenities"
          selected={filters.amenities.length}
          onClear={() => clearSection("amenities")}
        >
          {amenities.map((a) => (
            <FilterCheckRow
              key={a.value}
              label={a.label}
              count={a.count}
              checked={filters.amenities.includes(a.value)}
              onChange={() => toggle("amenities", a.value)}
            />
          ))}
        </FilterSection>
      )}
    </div>
  );

  return (
    <>
      <FilterPanel
        activeCount={activeCount}
        onClearAll={() => pushFilters(EMPTY_HOTEL_FILTERS)}
        isPending={isPending}
      >
        {filterContent}
      </FilterPanel>

      <FilterTrigger activeCount={activeCount} onOpen={() => setMobileOpen(true)} />

      <FilterDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeCount={activeCount}
        onClearAll={() => pushFilters(EMPTY_HOTEL_FILTERS)}
        applyLabel="Show Hotels"
      >
        {filterContent}
      </FilterDrawer>
    </>
  );
}
