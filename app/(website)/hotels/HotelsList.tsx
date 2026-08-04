"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/app/components/ui/Card";
import { StarIcon, MapPinIcon, ImagesIcon, ForkKnifeIcon } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { fetchHotelsPage, type HotelSearchCriteria } from "./search-actions";
import type { HotelCard, HotelSearchPage } from "./[slug]/booking-data";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

interface Props {
  initial: HotelSearchPage;
  /** Same criteria that produced `initial` — replayed for each subsequent page. */
  search: HotelSearchCriteria;
  /** Display name of the searched place, for the empty state copy. */
  city: string;
  /** Preserved check-in/check-out querystring, appended to each hotel link. */
  stayQs: string;
}

/** "3 Star Resort", "Resort", "3 Star" — whichever parts we actually know. */
function tierLine(h: HotelCard): string | null {
  const parts = [h.starRating ? `${h.starRating} Star` : null, h.propertyType].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** "Deluxe Room · Sleeps 2 · Double Bed" — the room the "from" price buys. */
function roomLine(h: HotelCard): string | null {
  if (!h.roomName) return null;
  return [
    h.roomName,
    h.maxOccupancy ? `Sleeps ${h.maxOccupancy}` : null,
    h.bedType,
  ].filter(Boolean).join(" · ");
}

/** One property per row: wide image left, details centre, price right. */
function HotelRow({ h, stayQs, priority }: { h: HotelCard; stayQs: string; priority: boolean }) {
  const tier = tierLine(h);
  const room = roomLine(h);

  return (
    <Link href={`/hotels/${h.slug}${stayQs ? `?${stayQs}` : ""}`} className="group block">
      <Card variant="elevated" radius="lg" className="overflow-hidden p-px hover:shadow-md transition-shadow ">
        <div className="flex flex-col sm:flex-row min-h-52 sm:min-h-54">
          <div className="relative h-52 sm:h-auto sm:w-64 md:w-72 shrink-0 overflow-hidden sm:rounded-l-[inherit]">
            <Image
              src={h.image}
              alt={h.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300 "
              sizes="(max-width:640px) 100vw, 300px"
              priority={priority}
            />
            {h.starRating ? (
              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-white bg-black/55 rounded-full px-2 py-0.5 backdrop-blur-[1px]">
                {h.starRating} <StarIcon size={11} weight="fill" className="text-amber-400" />
              </span>
            ) : null}
            {h.photoCount > 1 && (
              <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/55 rounded-full px-2.5 py-1 backdrop-blur-[1px]">
                <ImagesIcon size={12} weight="fill" />
                {h.photoCount} Photos
              </span>
            )}
          </div>

          <div className="flex flex-1 min-w-0 flex-col sm:flex-row">
            <div className="flex-1 min-w-0 p-4 sm:p-5">
              <p className="text-base sm:text-lg font-heading font-bold text-neutral-800 truncate group-hover:text-primary-500 transition-colors">
                {h.name}
              </p>

              <p className="flex items-center gap-1 text-xs text-neutral-600/90 mt-0.5">
                <MapPinIcon size={13} weight="fill" className="text-neutral-400/90" />
                {[h.city, h.state].filter(Boolean).join(", ") || "—"}
              </p>

              {tier && (
                <p className="mt-3 inline-block text-sm font-semibold text-neutral-700 border-l-2 border-primary-500 pl-2">
                  {tier}
                </p>
              )}

              {room && (
                <p className="mt-2 text-xs text-neutral-600/90 truncate">{room}</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {h.mealPlan && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600   rounded-full px-2 py-0.5">
                    <ForkKnifeIcon size={14} weight="fill" className="text-emerald-500/90" />
                    {h.mealPlan}
                  </span>
                )}
                {h.roomTypeCount > 1 && (
                  <span className="text-xs text-neutral-600/90  rounded-full px-2 py-0.5">
                    {h.roomTypeCount} room types
                  </span>
                )}
              </div>

              {h.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {h.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-[10px] text-neutral-500 bg-neutral-50 ring-1 ring-inset ring-neutral-200/75 shadow-sm shadow-neutral-200/80 rounded-full px-2 py-0.75"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Price rail: its own column on desktop, a footer strip on mobile */}
            <div className="flex sm:flex-col items-end sm:items-end justify-between sm:justify-center gap-2 shrink-0 px-4 pb-4 sm:p-5 sm:w-48 sm:border-l border-neutral-200/75 bg-linear-to-r from-neutral-50 to-white rounded-r-2xl">
              <div className="text-right">
                {h.priceFrom != null ? (
                  <>
                    <p className="text-[11px] text-neutral-600/90">Starting From</p>
                    <p className="text-xl font-bold font-heading text-neutral-900 leading-tight">
                      {money(h.priceFrom)}
                    </p>
                    {h.taxesFrom != null && (
                      <p className="text-[11px] text-neutral-500/90 mt-1">
                        + {money(h.taxesFrom)} taxes &amp; fees
                      </p>
                    )}
                    <p className="text-[11px] text-neutral-600/90">per night</p>
                  </>
                ) : (
                  <p className="text-xs text-neutral-400">Price on request</p>
                )}
              </div>
              <span className="text-xs font-bold text-primary-500 whitespace-nowrap">
                View →
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function HotelsList({ initial, search, city, stayQs }: Props) {
  const [items, setItems] = useState<HotelCard[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<number>>(new Set(initial.items.map((i) => i.id)));

  // No reset effect here on purpose: the search criteria are the only input
  // that changes the result set (dates only decorate the outgoing links), and
  // the parent keys this component on them — so a new search remounts with
  // fresh state rather than stacking new results under the previous ones.
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchHotelsPage(search, page + 1, initial.pageSize);
      // Dedupe defensively (offset pagination can drift if data changes mid-scroll)
      const fresh = next.items.filter((i) => !seenIds.current.has(i.id));
      fresh.forEach((i) => seenIds.current.add(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setPage(next.page);
      setHasMore(next.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, search, page, initial.pageSize]);

  // Auto-load next page when the sentinel scrolls into view
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

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
        <p className="text-sm font-semibold text-neutral-700">
          No properties found{city ? ` in ${city}` : ""}.
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          Try a different city, or clear some filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:gap-5">
        {items.map((h, index) => (
          <HotelRow key={h.id} h={h} stayQs={stayQs} priority={index < 3} />
        ))}
      </div>

      {/* Loading skeleton row while fetching the next page */}
      {loading && (
        <div className="flex flex-col gap-4 sm:gap-5 mt-4 sm:mt-5">
          {Array.from({ length: 3 }).map((_, i) => (
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
      )}

      {/* Error state with retry */}
      {error && (
        <div className="py-8 text-center">
          <p className="text-sm text-neutral-500 mb-3">Couldn&apos;t load more properties.</p>
          <Button variant="outline" size="sm" onClick={loadMore}>Try again</Button>
        </div>
      )}

      {/* Sentinel for IntersectionObserver */}
      {hasMore && !error && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

      {/* End-of-list marker */}
      {!hasMore && !loading && items.length > initial.pageSize && (
        <p className="py-8 text-center text-xs text-neutral-400">You&apos;ve reached the end.</p>
      )}
    </div>
  );
}
