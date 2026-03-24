// app/hooks/packages/usePackageHotels.ts
"use client";
import { useQuery }    from "@tanstack/react-query";
import { packagesApi } from "@/app/services/api/packages.api";

export function usePackageHotels(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ["package-hotels", slug],
    queryFn:  () => packagesApi.getHotels(slug),
    enabled,              // only fetch when Hotels tab is active
    staleTime: 300_000,   // 5 min — hotels don't change often
  });
}