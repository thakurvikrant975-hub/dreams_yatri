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

export type StayCategoryOption = { id: number; label: string; isDefault: boolean; slug: string };

export type TemplatePackage = LibraryPackage & {
    totalDays:           number | null;
    totalNights:         number | null;
    routeSummary:        string | null;
    stayCategorySummary: string | null;
    stayCategoryOptions: StayCategoryOption[];
    selectedStayCategoryId: number | null;
    estimatedPrice:      number | null;
    pricePerAdult:       number | null;
    /** Price fits inside the query's stated budget (per-adult vs. total, per `budgetType`) — null when no budget was given. */
    withinBudget:        boolean | null;
    /** Whether this package is currently live on the public site — inactive
     * ones are still selectable as a template here (the exec may want to
     * reuse an older/retired package), just flagged so it's obvious it
     * isn't something a client could currently browse to themselves. */
    isActive:            boolean;
};

async function priceForPackage(
    packageId: number,
    duration: { id: number } | undefined,
    route: { id: number } | undefined,
    stayCategoryId: number | undefined,
    opts: { adults: number; children: number; infants: number; travelDate: string | null },
): Promise<{ estimatedPrice: number | null; pricePerAdult: number | null }> {
    if (!duration || !route || !stayCategoryId) return { estimatedPrice: null, pricePerAdult: null };

    try {
        const breakdown = await computePackagePrice({
            package_id:       packageId,
            duration_id:      duration.id,
            route_id:         route.id,
            stay_category_id: stayCategoryId,
            adults:      opts.adults,
            children:    opts.children,
            infants:     opts.infants,
            travel_date: opts.travelDate,
        });
        if (breakdown.missing_pricing_config) return { estimatedPrice: null, pricePerAdult: null };
        return { estimatedPrice: breakdown.final_price, pricePerAdult: breakdown.price_per_adult };
    } catch {
        // Pricing config incomplete for this package/variant — show it without a price.
        return { estimatedPrice: null, pricePerAdult: null };
    }
}

/** Recomputes a single package's price against a different stay category —
 * used when the sales exec switches the stay-category dropdown on a
 * "Create Package" card instead of accepting the catalog default. */
export async function getTemplatePackagePriceForCategory(params: {
    packageId:      number;
    durationSlug:   string;
    routeSlug:      string;
    stayCategoryId: number;
    travelDate?:    string | null;
    adults?:        number;
    children?:      number;
    infants?:       number;
}): Promise<{ estimatedPrice: number | null; pricePerAdult: number | null }> {
    const { packageId, durationSlug, routeSlug, stayCategoryId, travelDate = null, adults = 2, children = 0, infants = 0 } = params;

    const duration = await db.package_durations.findFirst({
        where:  { package_id: packageId, slug: durationSlug },
        select: { id: true, routes: { where: { slug: routeSlug }, select: { id: true } } },
    });
    if (!duration || !duration.routes[0]) return { estimatedPrice: null, pricePerAdult: null };

    return priceForPackage(
        packageId, { id: duration.id }, { id: duration.routes[0].id },
        stayCategoryId,
        { adults, children, infants, travelDate },
    );
}

export async function searchPackageLibraryForTemplate(params: {
    search?:     string;
    page?:       number;
    size?:       number;
    travelDate?: string | null;
    adults?:     number;
    children?:   number;
    infants?:    number;
    /** When set, matching packages are sorted "within budget" first. */
    budgetMin?:  number;
    budgetMax?:  number;
    budgetType?: "PER_PERSON" | "TOTAL";
    /** The query's own destination — an exact-matching package is sorted to
     * the very top, ahead of budget fit, since it's the most directly
     * relevant template for what this lead actually asked about. */
    queryDestination?: string;
    /** The exact catalog package slug this lead's query came from (parsed
     * from their submitted packageUrl) — beats destination/budget sorting
     * entirely, since it's not a guess, it's literally the page they were on. */
    querySlug?: string;
    /** Multi-stop route search — e.g. ["Munnar", "Alleppey", "Kovalam"].
     * Only packages that have at least one route whose stops cover every
     * name given here are returned; the matching route (not necessarily the
     * package's default one) is what gets shown/priced/used-as-template. */
    routeStops?: string[];
    /** The query's requested trip length (e.g. 3D/2N) — when a package has a
     * duration variant that matches exactly, that variant (not the package's
     * default one) is what gets shown/priced/used-as-template, and the
     * package is sorted ahead of non-matching ones. */
    targetDuration?: { days: number; nights: number };
} = {}): Promise<{ packages: TemplatePackage[]; total: number }> {
    const {
        search = "", page = 1, size = 12,
        travelDate = null, adults = 2, children = 0, infants = 0,
        budgetMin, budgetMax, budgetType = "PER_PERSON",
        queryDestination, querySlug, routeStops, targetDuration,
    } = params;
    const safeSize = Math.min(size, 50);
    const hasBudget = budgetMin != null || budgetMax != null;
    const hasDestinationPriority = !!queryDestination?.trim();
    const hasSlugPriority = !!querySlug?.trim();
    const cleanStops = (routeStops ?? []).map((s) => s.trim()).filter(Boolean);
    const hasRouteStops = cleanStops.length > 0;
    const hasDurationPriority = targetDuration != null;
    const needsInMemorySort = hasBudget || hasDestinationPriority || hasSlugPriority || hasDurationPriority;
    // With a budget or destination-priority sort, we price/sort every match
    // (catalog is small — capped for safety) instead of just whichever page
    // happened to load first from the DB's own ordering.
    const PRICE_ALL_CAP = 200;

    const where = {
        // Inactive (not-live) packages are still shown as templates — just
        // flagged via isActive below — so an exec can reuse a retired
        // package's content instead of losing access to it entirely.
        ...(search ? {
            OR: [
                { title:       { contains: search, mode: "insensitive" as const } },
                { destination: { name: { contains: search, mode: "insensitive" as const } } },
                { destination: { region: { name: { contains: search, mode: "insensitive" as const } } } },
            ],
        } : {}),
        // Only keep packages that have a route covering every requested stop —
        // order isn't enforced, just "this itinerary passes through all of these".
        ...(hasRouteStops ? {
            durations: {
                some: {
                    is_active: true,
                    routes: {
                        some: {
                            is_active: true,
                            AND: cleanStops.map((name) => ({
                                stops: { some: { place_name: { contains: name, mode: "insensitive" as const } } },
                            })),
                        },
                    },
                },
            },
        } : {}),
    };

    // Route search needs to look at every duration/route/stop combo (not just
    // the package's default) to find the one that actually matches — a match
    // is often a non-default variant.
    const TEMPLATE_ROW_SELECT_ROUTE_MATCH = {
        id:          true,
        title:       true,
        slug:        true,
        thumbnail:   true,
        description: true,
        is_active:   true,
        destination: { select: { name: true, region: { select: { name: true } } } },
        stay_categories: {
            where:   { is_active: true as const },
            orderBy: { sort_order: "asc" as const },
            select:  { id: true, label: true, is_default: true, slug: true },
        },
        durations: {
            where:   { is_active: true as const },
            orderBy: { sort_order: "asc" as const },
            select:  {
                id: true, slug: true, days: true, nights: true, is_default: true,
                routes: {
                    where:   { is_active: true as const },
                    orderBy: { sort_order: "asc" as const },
                    select:  {
                        id:    true,
                        slug:  true,
                        stops: { orderBy: { sort_order: "asc" as const }, select: { place_name: true } },
                    },
                },
            },
        },
    };

    const TEMPLATE_ROW_SELECT = {
        id:          true,
        title:       true,
        slug:        true,
        thumbnail:   true,
        description: true,
        is_active:   true,
        destination: { select: { name: true, region: { select: { name: true } } } },
        stay_categories: {
            where:   { is_active: true as const },
            orderBy: { sort_order: "asc" as const },
            select:  { id: true, label: true, is_default: true, slug: true },
        },
        durations: {
            where:  { is_default: true as const },
            take:   1,
            select: {
                id: true, slug: true, days: true, nights: true,
                routes: {
                    orderBy: { sort_order: "asc" as const },
                    take:    1,
                    select:  {
                        id:    true,
                        slug:  true,
                        stops: { orderBy: { sort_order: "asc" as const }, select: { place_name: true } },
                    },
                },
            },
        },
    };

    /** Picks which duration/route to show for a package. Normally that's just
     * the default one, unless the query asked for a specific trip length and
     * this package has a variant matching it exactly — that wins over the
     * default so "Use Template" copies the right duration, not just
     * whichever one happens to be marked default. For a route search it's
     * whichever route actually covers every requested stop (default
     * duration preferred among matches, since `where` already guarantees at
     * least one match exists). */
    function pickDurationRoute(durations: {
        id: number; slug: string; days: number; nights: number; is_default?: boolean;
        routes: { id: number; slug: string; stops: { place_name: string }[] }[];
    }[]) {
        if (hasRouteStops) {
            const ordered = [...durations].sort((a, b) =>
                a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1,
            );
            for (const duration of ordered) {
                const route = duration.routes.find((rt) => {
                    const names = rt.stops.map((s) => s.place_name.toLowerCase());
                    return cleanStops.every((stop) => names.some((n) => n.includes(stop.toLowerCase())));
                });
                if (route) return { duration, route };
            }
            // Shouldn't happen — `where` already required a matching route to exist.
            const duration = durations[0];
            return { duration, route: duration?.routes[0] };
        }
        if (hasDurationPriority) {
            const match = durations.find((d) => d.days === targetDuration!.days && d.nights === targetDuration!.nights);
            if (match) return { duration: match, route: match.routes[0] };
        }
        const duration = durations.find((d) => d.is_default) ?? durations[0];
        return { duration, route: duration?.routes[0] };
    }

    async function mapTemplateRow(r: {
        id: number; title: string; slug: string; thumbnail: string | null; description: string | null;
        is_active: boolean;
        destination: { name: string; region: { name: string } | null };
        stay_categories: { id: number; label: string; is_default: boolean; slug: string }[];
        durations: { id: number; slug: string; days: number; nights: number; is_default?: boolean;
            routes: { id: number; slug: string; stops: { place_name: string }[] }[] }[];
    }): Promise<TemplatePackage> {
        const { duration, route } = pickDurationRoute(r.durations);
        const stayCategory = r.stay_categories.find((s) => s.is_default) ?? r.stay_categories[0];

        const { estimatedPrice, pricePerAdult } = await priceForPackage(
            r.id, duration, route, stayCategory?.id, { adults, children, infants, travelDate },
        );

        let withinBudget: boolean | null = null;
        if (hasBudget && estimatedPrice != null) {
            const compareValue = budgetType === "PER_PERSON" ? (pricePerAdult ?? estimatedPrice) : estimatedPrice;
            withinBudget = (budgetMin == null || compareValue >= budgetMin) && (budgetMax == null || compareValue <= budgetMax);
        }

        return {
            id:              r.id,
            title:           r.title,
            slug:            r.slug,
            thumbnail:       r.thumbnail,
            description:     r.description,
            destinationName: r.destination.name,
            regionName:      r.destination.region?.name ?? null,
            isActive:        r.is_active,
            durationSlug:    duration?.slug ?? null,
            routeSlug:       route?.slug ?? null,
            totalDays:       duration?.days ?? null,
            totalNights:     duration?.nights ?? null,
            routeSummary:    route?.stops.map((s) => s.place_name).join(" → ") || null,
            stayCategorySummary: r.stay_categories.map((s) => s.label).join(", ") || null,
            stayCategoryOptions: r.stay_categories.map((s) => ({ id: s.id, label: s.label, isDefault: s.is_default, slug: s.slug })),
            selectedStayCategoryId: stayCategory?.id ?? null,
            estimatedPrice,
            pricePerAdult,
            withinBudget,
        };
    }

    // Duration-priority needs every active duration variant to search for an
    // exact days/nights match (TEMPLATE_ROW_SELECT only fetches the default
    // one) — the route-match shape already selects all of them, so it's
    // reused here rather than adding a third near-identical select.
    const rowSelect = (hasRouteStops || hasDurationPriority) ? TEMPLATE_ROW_SELECT_ROUTE_MATCH : TEMPLATE_ROW_SELECT;

    let [total, rows] = await Promise.all([
        db.packages.count({ where }),
        db.packages.findMany({
            where,
            orderBy: { title: "asc" },
            ...(needsInMemorySort
                ? { take: PRICE_ALL_CAP }
                : { skip: (page - 1) * safeSize, take: safeSize }),
            select: rowSelect,
        }),
    ]);

    const packages: TemplatePackage[] = await Promise.all(rows.map(mapTemplateRow));

    // The exact package this lead's query came from must always be present,
    // even if it didn't match the free-text search filter above (e.g. the
    // search box defaulted to a destination name that isn't in this specific
    // package's title) — fetch and pin it separately rather than depend on
    // it surviving the `where` clause.
    if (hasSlugPriority && page === 1 && !packages.some((p) => p.slug === querySlug)) {
        const pinnedRow = await db.packages.findFirst({
            where:  { slug: querySlug },
            select: rowSelect,
        });
        if (pinnedRow) {
            packages.unshift(await mapTemplateRow(pinnedRow));
            total += 1;
        }
    }

    if (!needsInMemorySort) {
        return { packages, total };
    }

    // Sort the exact originating package first (not a guess — literally the
    // page this lead's query came from), then an exact trip-length match,
    // then exact-destination-match, then within-budget, then by how close
    // the price is to the budget (packages with no computed price sort last
    // for the budget tiebreak — we can't tell if they fit).
    const destKey = queryDestination?.trim().toLowerCase();
    const isDestMatch = (pkg: TemplatePackage) => !!destKey && pkg.destinationName.trim().toLowerCase() === destKey;
    const isSlugMatch = (pkg: TemplatePackage) => hasSlugPriority && pkg.slug === querySlug;
    const isDurationMatch = (pkg: TemplatePackage) =>
        hasDurationPriority && pkg.totalDays === targetDuration!.days && pkg.totalNights === targetDuration!.nights;
    const compareValue = (pkg: TemplatePackage) => budgetType === "PER_PERSON" ? (pkg.pricePerAdult ?? pkg.estimatedPrice) : pkg.estimatedPrice;
    const sorted = [...packages].sort((a, b) => {
        if (hasSlugPriority) {
            const aMatch = isSlugMatch(a);
            const bMatch = isSlugMatch(b);
            if (aMatch !== bMatch) return aMatch ? -1 : 1;
        }
        if (hasDurationPriority) {
            const aMatch = isDurationMatch(a);
            const bMatch = isDurationMatch(b);
            if (aMatch !== bMatch) return aMatch ? -1 : 1;
        }
        if (hasDestinationPriority) {
            const aMatch = isDestMatch(a);
            const bMatch = isDestMatch(b);
            if (aMatch !== bMatch) return aMatch ? -1 : 1;
        }
        if (!hasBudget) return a.title.localeCompare(b.title);
        if (a.withinBudget !== b.withinBudget) {
            if (a.withinBudget == null) return 1;
            if (b.withinBudget == null) return -1;
            return a.withinBudget ? -1 : 1;
        }
        const av = compareValue(a);
        const bv = compareValue(b);
        if (av == null) return 1;
        if (bv == null) return -1;
        return av - bv;
    });

    const start = (page - 1) * safeSize;
    return { packages: sorted.slice(start, start + safeSize), total };
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
    // includeInactive: this is the picker used both from the package library
    // (active packages only) and from CreatePackageDialog's "Use Template"
    // flow, which now also surfaces inactive packages — see fetchPackagePageData.
    const data = await fetchPackagePageData(packageSlug, durationSlug, "", "", { includeInactive: true });
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
