import { Suspense } from "react";
import type { Metadata } from "next";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import type { LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { Text } from "@/app/components/ui/Typography";
import { parsePackageFilters, packageFiltersKey } from "@/app/lib/packages/packageFacets";
import { readRoomGuests, totalAdults, totalChildAges } from "@/app/lib/packages/roomGuests";
import PackagesSearchBar from "./PackagesSearchBar";
import PackagesResults from "./PackagesResults";
import PackagesFilters, { FiltersSkeleton } from "./PackagesFilters";

function ResultsSkeleton() {
    return (
        <>
            <div className="skeleton-box h-8 w-72 rounded-lg mb-7" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden border border-neutral-100">
                        <div className="skeleton-box aspect-3/2 w-full" />
                        <div className="p-4 space-y-3">
                            <div className="skeleton-box h-5 w-3/4 rounded" />
                            <div className="skeleton-box h-4 w-1/2 rounded" />
                            <div className="skeleton-box h-8 w-full rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

export const metadata: Metadata = {
    title: "Holiday Packages | Dreams Yatri",
    description: "Browse and search curated holiday packages across India and beyond.",
};

function pick(v: string | string[] | undefined): string {
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

function travellersLabel(adults: number, children: number, rooms: number): string {
    const parts = [`${adults} Adult${adults !== 1 ? "s" : ""}`];
    if (children > 0) parts.push(`${children} Child${children !== 1 ? "ren" : ""}`);
    if (rooms > 1) parts.push(`${rooms} Rooms`);
    return parts.join(", ");
}

function formatDate(iso: string): string {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
}

function toLocationValue(id: string, name: string, type: string): LocationValue | null {
    if (!id) return null;
    return {
        id,
        name: name || "Selected location",
        type: (type || "CITY") as LocationType,
        breadcrumb: name || "",
        slug: "",
    };
}

export default async function PackagesIndexPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;
    const to = pick(sp.to);
    const toName = pick(sp.toName);
    const toType = pick(sp.toType);
    const from = pick(sp.from);
    const fromName = pick(sp.fromName);
    const fromType = pick(sp.fromType);
    const date = pick(sp.date);
    // `pax` carries the real per-room split; the flat adults/children/rooms
    // trio is the fallback for links written before it existed.
    const roomGuests = readRoomGuests((key) => pick(sp[key]));
    const adults = totalAdults(roomGuests);
    const childAges = totalChildAges(roomGuests);

    const travellers = travellersLabel(adults, childAges.length, roomGuests.length);
    const dateLabel = formatDate(date);

    const parsedDate = date ? new Date(`${date}T00:00:00`) : null;
    const initialDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

    const filters = parsePackageFilters((key) => pick(sp[key]));

    return (
        <>
            <Header />

            <PackagesSearchBar
                initialFrom={toLocationValue(from, fromName, fromType)}
                initialTo={toLocationValue(to, toName, toType)}
                initialDate={initialDate}
                initialRoomGuests={roomGuests}
            />

            <div className="screen-space py-8 pb-24 lg:pb-8">
                <Text size="sm" intent="secondary" className="mb-7 block">
                    Prices shown for {travellers}{dateLabel ? ` · ${dateLabel}` : ""}
                </Text>

                <div className="flex gap-7">
                    <Suspense fallback={<FiltersSkeleton />}>
                        <PackagesFilters to={to} filters={filters} />
                    </Suspense>

                    <div className="flex-1 min-w-0">
                        {/* Re-keyed on the filter selection so changing a filter
                            re-suspends and shows the skeleton instead of leaving
                            stale cards on screen. */}
                        <Suspense key={packageFiltersKey(filters)} fallback={<ResultsSkeleton />}>
                            <PackagesResults
                                to={to}
                                toName={toName}
                                adults={adults}
                                childAges={childAges}
                                travelDate={date || null}
                                filters={filters}
                            />
                        </Suspense>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
}
