"use server";

// (sales)/package-library/actions.ts
//
// Read-only browse of the real, live package catalog for Sales Executives.
// The catalog itself is managed by Admin (`/dashboard/packages`) and is never
// mutated from here — this only surfaces what's already active so a sales
// exec can reference or share a premade package.

import { db } from "@/app/lib/db";

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
