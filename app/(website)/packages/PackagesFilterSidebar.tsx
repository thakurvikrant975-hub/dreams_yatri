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
import type { PackageSearchFacets } from "@/app/actions/search/package-facets";
import {
  EMPTY_PACKAGE_FILTERS,
  applyPackageFilters,
  countActivePackageFilters,
  type PackageFilters,
} from "@/app/lib/packages/packageFacets";

interface Props {
  facets: PackageSearchFacets;
  initialFilters: PackageFilters;
}

export default function PackagesFilterSidebar({ facets, initialFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [mobileOpen, setMobileOpen] = useState(false);

  // The URL is the source of truth, so a checkbox would otherwise stay unticked
  // until the server finished re-rendering the results. The optimistic copy
  // ticks it immediately and falls back to the server's own answer once the
  // transition settles — which also covers the back button and shared links.
  const [filters, applyOptimistic] = useOptimistic(initialFilters);

  // ── URL helpers ────────────────────────────────────────────────────────
  // Filters live in the query string, alongside the search bar's own params —
  // which is why we copy the current params rather than build a fresh set.

  function pushFilters(next: PackageFilters) {
    const params = applyPackageFilters(new URLSearchParams(searchParams.toString()), next);
    const qs = params.toString();
    startTransition(() => {
      applyOptimistic(next);
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    });
  }

  function toggle<K extends keyof PackageFilters>(
    key: K,
    value: PackageFilters[K][number],
  ) {
    const current = filters[key] as (string | number)[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    pushFilters({ ...filters, [key]: next } as PackageFilters);
  }

  function clearSection(key: keyof PackageFilters) {
    pushFilters({ ...filters, [key]: [] } as PackageFilters);
  }

  function clearAll() {
    pushFilters(EMPTY_PACKAGE_FILTERS);
  }

  const activeCount = countActivePackageFilters(filters);

  // ── Sidebar content (shared desktop + mobile) ──────────────────────────

  const filterContent = (
    <div className="space-y-6">
      <FilterSection
        title="Budget"
        subtitle="Per adult"
        selected={filters.budgets.length}
        onClear={() => clearSection("budgets")}
      >
        {facets.budgets.map((b) => (
          <FilterCheckRow
            key={b.slug}
            label={b.label}
            checked={filters.budgets.includes(b.slug)}
            onChange={() => toggle("budgets", b.slug)}
          />
        ))}
      </FilterSection>

      {facets.durations.length > 0 && (
        <FilterSection
          title="Duration"
          selected={filters.durations.length}
          onClear={() => clearSection("durations")}
        >
          {facets.durations.map((d) => (
            <FilterCheckRow
              key={d.slug}
              label={d.label}
              count={d.count}
              checked={filters.durations.includes(d.slug)}
              onChange={() => toggle("durations", d.slug)}
            />
          ))}
        </FilterSection>
      )}

      {facets.destinations.length > 1 && (
        <FilterSection
          title="Destination"
          selected={filters.destinationIds.length}
          onClear={() => clearSection("destinationIds")}
        >
          {facets.destinations.map((d) => (
            <FilterCheckRow
              key={d.id}
              label={d.name}
              count={d.count}
              checked={filters.destinationIds.includes(d.id)}
              onChange={() => toggle("destinationIds", d.id)}
            />
          ))}
        </FilterSection>
      )}

      {facets.themes.length > 0 && (
        <FilterSection
          title="Category"
          selected={filters.themes.length}
          onClear={() => clearSection("themes")}
        >
          {facets.themes.map((t) => (
            <FilterCheckRow
              key={t.slug}
              label={t.label}
              count={t.count}
              checked={filters.themes.includes(t.slug)}
              onChange={() => toggle("themes", t.slug)}
            />
          ))}
        </FilterSection>
      )}

      {facets.stayTiers.length > 0 && (
        <FilterSection
          title="Stay Type"
          selected={filters.stayTiers.length}
          onClear={() => clearSection("stayTiers")}
        >
          {facets.stayTiers.map((s) => (
            <FilterCheckRow
              key={s.slug}
              label={s.label}
              hint={s.hint}
              count={s.count}
              checked={filters.stayTiers.includes(s.slug)}
              onChange={() => toggle("stayTiers", s.slug)}
            />
          ))}
        </FilterSection>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <FilterPanel activeCount={activeCount} onClearAll={clearAll} isPending={isPending}>
        {filterContent}
      </FilterPanel>

      <FilterTrigger activeCount={activeCount} onOpen={() => setMobileOpen(true)} />

      <FilterDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeCount={activeCount}
        onClearAll={clearAll}
        applyLabel="Show Packages"
      >
        {filterContent}
      </FilterDrawer>
    </>
  );
}
