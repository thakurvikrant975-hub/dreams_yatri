// app/hooks/packages/usePackagePricing.ts
"use client";
import { useQuery }    from "@tanstack/react-query";
import { packagesApi } from "@/app/services/api/packages.api";

export function usePackagePricing(slug: string) {
  return useQuery({
    queryKey:  ["package-pricing", slug],
    queryFn:   () => packagesApi.getPricing(slug),
    staleTime: 0,        // always refetch — pricing must be fresh
    gcTime:    60_000,   // keep in memory 1 min
    refetchOnWindowFocus: true,  // refetch when user comes back to tab
  });
}