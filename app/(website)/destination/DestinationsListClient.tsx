"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, X } from "lucide-react";
import DestinationCard from "@/app/components/destinations/Destination";
import {
  FilterCheckRow,
  FilterDrawer,
  FilterPanel,
  FilterRadioRow,
  FilterSection,
  FilterTrigger,
} from "@/app/components/filters/FilterPanel";
import {
  fetchDestinationsPage,
  type DestinationListItem,
  type DestinationListPage,
  type DestinationSidebarData,
  type DestinationFilters,
} from "@/app/actions/destinations/fetch-destination-page";

const PAGE_SIZE = 12;

interface Props {
  initial: DestinationListPage;
  sidebar: DestinationSidebarData;
  initialFilters: DestinationFilters;
}

export default function DestinationsListClient({ initial, sidebar, initialFilters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<DestinationFilters>(initialFilters);
  const [items, setItems] = useState<DestinationListItem[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set(initial.items.map((i) => i.id)));
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Stable key representing the current server-side filter state.
  // Changes whenever the server re-renders with new URL params.
  const filterKey = `${initialFilters.type}|${[...initialFilters.regionIds].sort().join(",")}|${[...initialFilters.countries].sort().join(",")}`;
  const prevFilterKey = useRef(filterKey);

  // Sync items/page/hasMore when the server re-renders with new URL params,
  // then scroll back to the top of the cards area so sparse results don't
  // leave the viewport stuck below the content with the footer visible.
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return;
    prevFilterKey.current = filterKey;
    seenIds.current = new Set(initial.items.map((i) => i.id));
    setItems(initial.items);
    setPage(1);
    setHasMore(initial.hasMore);
    setTotal(initial.total);
    setFilters(initialFilters);
    setError(false);
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [filterKey, initial, initialFilters]);

  // ── URL helpers ────────────────────────────────────────────────────────

  function pushFilters(f: DestinationFilters) {
    const params = new URLSearchParams();
    if (f.type !== "all") params.set("type", f.type);
    if (f.regionIds.length > 0) params.set("regions", f.regionIds.join(","));
    if (f.countries.length > 0) params.set("countries", f.countries.join(","));
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    });
  }

  // ── Filter actions ─────────────────────────────────────────────────────

  function setType(t: "all" | "domestic" | "international") {
    const next: DestinationFilters = {
      type: t,
      regionIds: t === "international" ? [] : filters.regionIds,
      countries: t === "domestic" ? [] : filters.countries,
    };
    setFilters(next);
    pushFilters(next);
  }

  function toggleRegion(id: number) {
    const next: DestinationFilters = {
      type: filters.type === "international" ? "all" : filters.type,
      regionIds: filters.regionIds.includes(id)
        ? filters.regionIds.filter((r) => r !== id)
        : [...filters.regionIds, id],
      countries: filters.countries,
    };
    setFilters(next);
    pushFilters(next);
  }

  function toggleCountry(c: string) {
    const next: DestinationFilters = {
      type: filters.type === "domestic" ? "all" : filters.type,
      regionIds: filters.regionIds,
      countries: filters.countries.includes(c)
        ? filters.countries.filter((x) => x !== c)
        : [...filters.countries, c],
    };
    setFilters(next);
    pushFilters(next);
  }

  function clearAll() {
    const next: DestinationFilters = { type: "all", regionIds: [], countries: [] };
    setFilters(next);
    pushFilters(next);
  }

  // ── Infinite scroll ────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchDestinationsPage(filtersRef.current, page + 1, PAGE_SIZE);
      const fresh = result.items.filter((i) => !seenIds.current.has(i.id));
      fresh.forEach((i) => seenIds.current.add(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setPage((p) => p + 1);
      setHasMore(result.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  useEffect(() => {
    if (!hasMore || error) return;
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "400px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasMore, error, loadMore]);

  // ── Derived ────────────────────────────────────────────────────────────

  const activeCount =
    (filters.type !== "all" ? 1 : 0) +
    filters.regionIds.length +
    filters.countries.length;

  const regionsDisabled = filters.type === "international";
  const countriesDisabled = filters.type === "domestic";

  // ── Sidebar content (shared desktop + mobile) ──────────────────────────

  const filterContent = (
    <div className="space-y-6">
      <FilterSection title="Destination Type" selected={0}>
        {(
          [
            { id: "all" as const, label: "All Destinations", count: sidebar.total },
            { id: "domestic" as const, label: "Domestic", count: sidebar.totalDomestic },
            { id: "international" as const, label: "International", count: sidebar.totalInternational },
          ] as const
        ).map((opt) => (
          <FilterRadioRow
            key={opt.id}
            label={opt.label}
            count={opt.count}
            active={filters.type === opt.id}
            onSelect={() => setType(opt.id)}
          />
        ))}
      </FilterSection>

      {/* Regions — always visible, disabled when International is selected */}
      {sidebar.regions.length > 0 && (
        <FilterSection
          title="Region"
          selected={filters.regionIds.length}
          disabled={regionsDisabled}
          disabledNote="Domestic only"
          onClear={() => { const next = { ...filters, regionIds: [] }; setFilters(next); pushFilters(next); }}
        >
          {sidebar.regions.map((r) => (
            <FilterCheckRow
              key={r.id}
              label={r.name}
              count={r.count}
              checked={filters.regionIds.includes(r.id)}
              disabled={regionsDisabled}
              onChange={() => toggleRegion(r.id)}
            />
          ))}
        </FilterSection>
      )}

      {/* Countries — always visible, disabled when Domestic is selected */}
      {sidebar.countries.length > 0 && (
        <FilterSection
          title="Country"
          selected={filters.countries.length}
          disabled={countriesDisabled}
          disabledNote="International only"
          onClear={() => { const next = { ...filters, countries: [] }; setFilters(next); pushFilters(next); }}
        >
          {sidebar.countries.map((c) => (
            <FilterCheckRow
              key={c.name}
              label={c.name}
              count={c.count}
              checked={filters.countries.includes(c.name)}
              disabled={countriesDisabled}
              onChange={() => toggleCountry(c.name)}
            />
          ))}
        </FilterSection>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="screen-space mx-auto py-8 pb-24 lg:pb-8">
      <div className="flex gap-7">
        <FilterPanel activeCount={activeCount} onClearAll={clearAll} isPending={isPending}>
          {filterContent}
        </FilterPanel>

        {/* Main content */}
        <div
          ref={contentRef}
          className="flex-1 min-w-0"
          style={{
            minHeight: "calc(100svh - var(--spacing-header-height))",
            scrollMarginTop: "calc(var(--spacing-header-height) + 1rem)",
          }}
        >
          {/* Results bar */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-neutral-500">
              {isPending ? (
                <span className="text-neutral-400">Loading…</span>
              ) : (
                <>
                  <span className="font-semibold text-neutral-800">{total}</span>{" "}
                  destination{total !== 1 ? "s" : ""} found
                </>
              )}
            </p>
            {activeCount > 0 && !isPending && (
              <button
                onClick={clearAll}
                className="hidden sm:flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          {/* Pending overlay shimmer */}
          {isPending ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="relative w-full">
                  <div className="w-4/5 aspect-3/4 rounded-xl bg-neutral-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Grid */}
              {items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((dest) => (
                    <Link key={dest.id} href={`/destination/${dest.slug}`} className="block">
                      <DestinationCard
                        name={dest.name}
                        packageCount={dest.packageCount}
                        image={dest.image}
                        region={
                          dest.country !== "India" ? dest.country : (dest.region ?? undefined)
                        }
                      />
                    </Link>
                  ))}
                </div>
              )}

              {/* Infinite scroll loading skeletons */}
              {loading && (
                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 ${items.length > 0 ? "mt-4" : ""}`}>
                  {Array.from({ length: items.length === 0 ? 12 : 4 }).map((_, i) => (
                    <div key={i} className="relative w-full">
                      <div className="w-4/5 aspect-3/4 rounded-xl bg-neutral-100 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <MapPin className="h-12 w-12 text-neutral-300 mb-4" />
                  <p className="font-semibold text-neutral-700">No destinations found</p>
                  <p className="text-sm text-neutral-400 mt-1">Try adjusting your filters</p>
                  {activeCount > 0 && (
                    <button onClick={clearAll} className="mt-4 text-sm text-primary hover:underline">
                      Clear all filters
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="py-8 text-center">
                  <p className="text-sm text-neutral-500 mb-3">Couldn&apos;t load more.</p>
                  <button onClick={loadMore} className="text-sm text-primary hover:underline">
                    Try again
                  </button>
                </div>
              )}

              {/* Sentinel */}
              {hasMore && !error && (
                <div ref={sentinelRef} className="h-px w-full mt-4" aria-hidden />
              )}

              {!hasMore && !loading && items.length >= PAGE_SIZE && (
                <p className="py-10 text-center text-xs text-neutral-400">
                  You&apos;ve seen all destinations
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <FilterTrigger activeCount={activeCount} onOpen={() => setMobileOpen(true)} />

      <FilterDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeCount={activeCount}
        onClearAll={clearAll}
        applyLabel={`Show ${total} Destination${total !== 1 ? "s" : ""}`}
      >
        {filterContent}
      </FilterDrawer>
    </div>
  );
}
