// app/hooks/packages/usePackageActivities.ts
"use client";
import { useQuery }    from "@tanstack/react-query";
import { packagesApi } from "@/app/services/api/packages.api";

export function usePackageActivities(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ["package-activities", slug],
    queryFn:  () => packagesApi.getActivities(slug),
    enabled,
    staleTime: 300_000,
  });
}