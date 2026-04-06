"use client";
// app/hooks/useHotels.ts

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchHotels,
  type HotelCardData,
  type HotelFilters,
  type HotelListMeta,
} from "@/app/types/hotels/hotels";

type UseHotelsReturn = {
  hotels:    HotelCardData[];
  meta:      HotelListMeta | null;
  loading:   boolean;
  error:     string | null;
  setFilter: (key: keyof HotelFilters, value: HotelFilters[keyof HotelFilters]) => void;
  setPage:   (page: number) => void;
  reset:     () => void;
  filters:   HotelFilters;
};

const DEFAULT_FILTERS: HotelFilters = {
  page:  1,
  limit: 12,
  sort:  "newest",
};

export function useHotels(initialFilters: HotelFilters = {}): UseHotelsReturn {
  const [filters, setFilters] = useState<HotelFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [hotels,  setHotels]  = useState<HotelCardData[]>([]);
  const [meta,    setMeta]    = useState<HotelListMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Abort controller to cancel stale requests
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (f: HotelFilters) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await fetchHotels(f);
      setHotels(result.data);
      setMeta(result.meta);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message ?? "Failed to load hotels");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever filters change
  useEffect(() => {
    load(filters);
  }, [filters, load]);

  function setFilter(key: keyof HotelFilters, value: HotelFilters[keyof HotelFilters]) {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // Reset to page 1 on any filter change except pagination
      ...(key !== "page" && { page: 1 }),
    }));
  }

  function setPage(page: number) {
    setFilters(prev => ({ ...prev, page }));
  }

  function reset() {
    setFilters({ ...DEFAULT_FILTERS, ...initialFilters });
  }

  return { hotels, meta, loading, error, setFilter, setPage, reset, filters };
}