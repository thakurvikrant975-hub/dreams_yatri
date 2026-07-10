"use server";

// (sales)/package-library/actions.ts
//
// Read-only browse of the real, live package catalog for Sales Executives.
// The catalog itself is managed by Admin (`/dashboard/packages`) and is never
// mutated from here — this only surfaces what's already active so a sales
// exec can reference or share a premade package.

import { db } from "@/app/lib/db";
import { fetchPackagePageData } from "@/app/actions/packages/fetch-page-data";
import { computePackagePrice } from "@/app/services/package-pricing.service";

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

// ─────────────────────────────────────────────────────────────────────────────
// "Create Package" popup — a searchable, paginated (load-more) package list
// with enough of a summary (route, stay categories, duration) to pick a
// template without leaving the dialog. Search matches title, destination, and
// region, so pre-filling it with a query's destination gets a relevant first
// page while staying editable.
// ─────────────────────────────────────────────────────────────────────────────

export type TemplatePackage = LibraryPackage & {
    totalDays:           number | null;
    totalNights:         number | null;
    routeSummary:        string | null;
    stayCategorySummary: string | null;
    estimatedPrice:      number | null;
    pricePerAdult:       number | null;
};

export async function searchPackageLibraryForTemplate(params: {
    search?:     string;
    page?:       number;
    size?:       number;
    travelDate?: string | null;
    adults?:     number;
    children?:   number;
    infants?:    number;
} = {}): Promise<{ packages: TemplatePackage[]; total: number }> {
    const {
        search = "", page = 1, size = 12,
        travelDate = null, adults = 2, children = 0, infants = 0,
    } = params;
    const safeSize = Math.min(size, 50);
    const skip = (page - 1) * safeSize;

    const where = {
        is_active: true,
        ...(search ? {
            OR: [
                { title:       { contains: search, mode: "insensitive" as const } },
                { destination: { name: { contains: search, mode: "insensitive" as const } } },
                { destination: { region: { name: { contains: search, mode: "insensitive" as const } } } },
            ],
        } : {}),
    };

    const [total, rows] = await Promise.all([
        db.packages.count({ where }),
        db.packages.findMany({
            where,
            orderBy: { title: "asc" },
            skip,
            take: safeSize,
            select: {
                id:          true,
                title:       true,
                slug:        true,
                thumbnail:   true,
                description: true,
                destination: { select: { name: true, region: { select: { name: true } } } },
                stay_categories: {
                    where:   { is_active: true },
                    orderBy: { sort_order: "asc" },
                    select:  { id: true, label: true, is_default: true },
                },
                durations: {
                    where:  { is_default: true },
                    take:   1,
                    select: {
                        id: true, slug: true, days: true, nights: true,
                        routes: {
                            orderBy: { sort_order: "asc" },
                            take:    1,
                            select:  {
                                id:    true,
                                slug:  true,
                                stops: { orderBy: { sort_order: "asc" }, select: { place_name: true } },
                            },
                        },
                    },
                },
            },
        }),
    ]);

    const packages: TemplatePackage[] = await Promise.all(rows.map(async (r) => {
        const duration = r.durations[0];
        const route = duration?.routes[0];
        const stayCategory = r.stay_categories.find((s) => s.is_default) ?? r.stay_categories[0];

        let estimatedPrice: number | null = null;
        let pricePerAdult: number | null = null;
        if (duration && route && stayCategory) {
            try {
                const breakdown = await computePackagePrice({
                    package_id:       r.id,
                    duration_id:      duration.id,
                    route_id:         route.id,
                    stay_category_id: stayCategory.id,
                    adults, children, infants,
                    travel_date: travelDate,
                });
                if (!breakdown.missing_pricing_config) {
                    estimatedPrice = breakdown.final_price;
                    pricePerAdult = breakdown.price_per_adult;
                }
            } catch {
                // Pricing config incomplete for this package/variant — show it without a price.
            }
        }

        return {
            id:              r.id,
            title:           r.title,
            slug:            r.slug,
            thumbnail:       r.thumbnail,
            description:     r.description,
            destinationName: r.destination.name,
            regionName:      r.destination.region?.name ?? null,
            durationSlug:    duration?.slug ?? null,
            routeSlug:       route?.slug ?? null,
            totalDays:       duration?.days ?? null,
            totalNights:     duration?.nights ?? null,
            routeSummary:    route?.stops.map((s) => s.place_name).join(" → ") || null,
            stayCategorySummary: r.stay_categories.map((s) => s.label).join(", ") || null,
            estimatedPrice,
            pricePerAdult,
        };
    }));

    return { packages, total };
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
