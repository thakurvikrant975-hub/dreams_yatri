"use server";

// (sales)/package-library/actions.ts
//
// Read-only browse of the real, live package catalog for Sales Executives.
// The catalog itself is managed by Admin (`/dashboard/packages`) and is never
// mutated from here — this only surfaces what's already active so a sales
// exec can reference or share a premade package.

import { db } from "@/app/lib/db";
import { fetchPackagePageData } from "@/app/actions/packages/fetch-page-data";

export type LibraryPackage = {
    id:              number;
    title:           string;
    slug:            string;
    thumbnail:       string | null;
    description:     string | null;
    destinationName: string;
    regionName:      string | null;
    durationSlug:    string | null;
    routeSlug:       string | null;
};

export type DestinationFilterOption = { id: number; name: string };

export async function getSalesPackageLibrary(params: {
    search?:        string;
    destinationId?: number | "all";
} = {}): Promise<LibraryPackage[]> {
    const { search = "", destinationId = "all" } = params;

    const rows = await db.packages.findMany({
        where: {
            is_active: true,
            ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
            ...(destinationId !== "all" ? { destination_id: destinationId } : {}),
        },
        orderBy: { title: "asc" },
        select: {
            id:          true,
            title:       true,
            slug:        true,
            thumbnail:   true,
            description: true,
            destination: { select: { name: true, region: { select: { name: true } } } },
            durations: {
                where:  { is_default: true },
                take:   1,
                select: {
                    slug:   true,
                    routes: { orderBy: { sort_order: "asc" }, take: 1, select: { slug: true } },
                },
            },
        },
    });

    return rows.map((r) => ({
        id:              r.id,
        title:           r.title,
        slug:            r.slug,
        thumbnail:       r.thumbnail,
        description:     r.description,
        destinationName: r.destination.name,
        regionName:      r.destination.region?.name ?? null,
        durationSlug:    r.durations[0]?.slug ?? null,
        routeSlug:       r.durations[0]?.routes[0]?.slug ?? null,
    }));
}

export async function getDestinationsForLibraryFilter(): Promise<DestinationFilterOption[]> {
    return db.destinations.findMany({
        where:   { packages: { some: { is_active: true } } },
        select:  { id: true, name: true },
        orderBy: { name: "asc" },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// "Use It" — variant picker options (duration/route/stay-category) for a
// package, so a sales exec can choose which version to copy before it's
// dropped into their custom itinerary draft.
// ─────────────────────────────────────────────────────────────────────────────

export type PackageVariantOptions = {
    packageId:         number;
    durations:         { slug: string; label: string; days: number; nights: number; isDefault: boolean }[];
    routes:            { slug: string; name: string }[];
    stayCategories:    { slug: string; label: string }[];
    selectedDurationSlug: string;
    selectedRouteSlug:    string;
    selectedStaySlug:     string;
};

/**
 * Loads the picker options for one duration of a package. Passing an empty
 * routeSlug/staySlug lets fetchPackagePageData resolve sensible defaults
 * (first route, default stay category) — same fallback the live package page
 * itself relies on.
 */
export async function getPackageVariantOptions(
    packageSlug:  string,
    durationSlug: string,
): Promise<PackageVariantOptions | null> {
    const data = await fetchPackagePageData(packageSlug, durationSlug, "", "");
    if (!data) return null;

    return {
        packageId: data.id,
        durations: data.durations.map((d) => ({
            slug: d.slug, label: d.label, days: d.days, nights: d.nights, isDefault: d.is_default,
        })),
        routes: data.currentDuration.routes.map((r) => ({ slug: r.slug, name: r.name })),
        stayCategories: data.stay_categories.map((s) => ({ slug: s.slug, label: s.label })),
        selectedDurationSlug: data.currentDuration.slug,
        selectedRouteSlug:    data.selectedRoute?.slug ?? "",
        selectedStaySlug:     data.selectedStay?.slug ?? "",
    };
}
