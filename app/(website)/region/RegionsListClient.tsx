"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { MapPin } from "lucide-react";
import RegionCard from "@/app/components/regions/RegionCard";
import { FilterCheckRow } from "@/app/components/filters/FilterPanel";
import {
  fetchRegionsPage,
  type RegionListItem,
  type RegionListPage,
  type RegionSidebarData,
  type RegionFilters,
} from "@/app/actions/regions/fetch-region-page";

const PAGE_SIZE = 12;

interface Props {
  initial: RegionListPage;
  sidebar: RegionSidebarData;
  initialFilters: RegionFilters;
}

export default function RegionsListClient({ initial, sidebar, initialFilters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<RegionFilters>(initialFilters);
  const [items, setItems] = useState<RegionListItem[]>(initial.items);
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

  const filterKey = [...initialFilters.countries].sort().join(",");
  const prevFilterKey = useRef(filterKey);

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

  function pushFilters(f: RegionFilters) {
    const params = new URLSearchParams();
    if (f.countries.length > 0) params.set("countries", f.countries.join(","));
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    });
  }

  function toggleCountry(c: string) {
    const next: RegionFilters = {
      countries: filters.countries.includes(c)
        ? filters.countries.filter((x) => x !== c)
        : [...filters.countries, c],
    };
    setFilters(next);
    pushFilters(next);
  }

  function clearAll() {
    const next: RegionFilters = { countries: [] };
    setFilters(next);
    pushFilters(next);
  }

  // ── Infinite scroll ────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchRegionsPage(filtersRef.current, page + 1, PAGE_SIZE);
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

  const activeCount = filters.countries.length;
  const showCountryFilter = sidebar.countries.length > 1;

  // ── Sidebar content (shared desktop + mobile) ──────────────────────────

  const filterContent = (
    <div className="space-y-6">
      {/* Total */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">
          Regions
        </p>
        <button
          onClick={clearAll}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            activeCount === 0
              ? "bg-primary/10 text-primary font-medium"
              : "text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          <span>All Regions</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-md ${
              activeCount === 0
                ? "bg-primary/15 text-primary"
                : "text-neutral-400 bg-neutral-100"
            }`}
          >
            {sidebar.total}
          </span>
        </button>
      </div>

      {/* Country filter — only shown when multiple countries exist */}
      {showCountryFilter && (
        <>
          <div className="border-t border-neutral-100" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Country
              </p>
              {filters.countries.length > 0 && (
                <button
                  onClick={() => { const next = { countries: [] }; setFilters(next); pushFilters(next); }}
                  className="text-[10px] text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-2">
              {sidebar.countries.map((c) => (
                <FilterCheckRow
                  key={c.name}
                  label={c.name}
                  count={c.count}
                  checked={filters.countries.includes(c.name)}
                  onChange={() => toggleCountry(c.name)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="screen-space mx-auto py-8 pb-24 lg:pb-8">
      <div className="flex gap-7">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div
            className="sticky flex flex-col bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden"
            style={{
              top: "calc(var(--spacing-header-height) + 1rem)",
              height: "calc(100svh - var(--spacing-header-height) - 2rem)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
              <p className="font-semibold text-neutral-800 text-sm">Filters</p>
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-xs text-primary hover:underline font-medium">
                  Clear all
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-slim">
              {filterContent}
            </div>
          </div>
        </aside>

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
                  region{total !== 1 ? "s" : ""} found
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-neutral-100 animate-pulse">
                  <div className="w-full aspect-video" />
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-neutral-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 rounded-full bg-neutral-200 w-2/3" />
                      <div className="h-2.5 rounded-full bg-neutral-200 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Grid */}
              {items.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((region) => (
                    <Link key={region.id} href={`/region/${region.slug}`} className="block">
                      <RegionCard
                        name={region.name}
                        packageCount={region.packageCount}
                        image={region.image}
                        country={region.country !== "India" ? region.country : undefined}
                      />
                    </Link>
                  ))}
                </div>
              )}

              {/* Infinite scroll loading skeletons */}
              {loading && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 ${items.length > 0 ? "mt-5" : ""}`}>
                  {Array.from({ length: items.length === 0 ? 9 : 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden bg-neutral-100 animate-pulse">
                      <div className="w-full aspect-video" />
                      <div className="px-4 py-3.5 flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-neutral-200" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 rounded-full bg-neutral-200 w-2/3" />
                          <div className="h-2.5 rounded-full bg-neutral-200 w-1/3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <MapPin className="h-12 w-12 text-neutral-300 mb-4" />
                  <p className="font-semibold text-neutral-700">No regions found</p>
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
                  You&apos;ve seen all regions
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter bar — only shown when country filter is available.
          Offset by the mobile bottom nav, which sits below it. */}
      {showCountryFilter && (
        <div className="lg:hidden fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-30 bg-white border-t border-neutral-100 px-4 py-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-full text-sm font-medium bg-white shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 bg-primary text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-72 bg-white h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <p className="font-semibold text-neutral-800 text-sm">Filters</p>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{filterContent}</div>
            <div className="px-5 py-4 border-t border-neutral-100 space-y-2">
              {activeCount > 0 && (
                <button
                  onClick={() => { clearAll(); setMobileOpen(false); }}
                  className="w-full py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium"
              >
                Show {total} Regions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
