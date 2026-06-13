import type { Metadata } from "next";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import { searchPackages } from "@/app/actions/search/search-packages";
import type { LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { Heading, Text } from "@/app/components/ui/Typography";
import PackagesList from "./PackagesList";
import PackagesSearchBar from "./PackagesSearchBar";

export const metadata: Metadata = {
    title: "Holiday Packages | Dreams Yatri",
    description: "Browse and search curated holiday packages across India and beyond.",
};

function pick(v: string | string[] | undefined): string {
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

function travellersLabel(adults: number, children: number): string {
    const parts = [`${adults} Adult${adults !== 1 ? "s" : ""}`];
    if (children > 0) parts.push(`${children} Child${children !== 1 ? "ren" : ""}`);
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
    const adults = Math.max(1, parseInt(pick(sp.adults) || "2", 10) || 2);
    const childrenRaw = pick(sp.children);
    const childAges = childrenRaw
        ? childrenRaw.split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n))
        : [];

    const travellers = travellersLabel(adults, childAges.length);
    const dateLabel = formatDate(date);

    const parsedDate = date ? new Date(`${date}T00:00:00`) : null;
    const initialDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

    // No `to` → list all active packages; with `to` → location-matched results.
    const { items } = await searchPackages({
        toLocationId: to || undefined,
        adults,
        childAges,
        travelDate: date || null,
    });

    const isSearch = Boolean(to);
    const heading = isSearch
        ? (items.length > 0
            ? `${items.length} package${items.length !== 1 ? "s" : ""} near ${toName || "you"}`
            : `Packages near ${toName || "you"}`)
        : "All Holiday Packages";

    return (
        <>
            <Header />

            <PackagesSearchBar
                initialFrom={toLocationValue(from, fromName, fromType)}
                initialTo={toLocationValue(to, toName, toType)}
                initialDate={initialDate}
                initialTravellers={{ adults, childrenAges: childAges }}
            />

            <div className="screen-space py-8">
                <Heading level={2} weight="semibold">{heading}</Heading>
                <Text size="sm" intent="secondary" className="mt-1 mb-7 block">
                    Prices shown for {travellers}{dateLabel ? ` · ${dateLabel}` : ""}
                </Text>

                {items.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-base font-semibold text-primary">
                            {isSearch ? `No packages found near ${toName || "this location"}` : "No packages available yet"}
                        </p>
                        <p className="text-sm text-secondary mt-1 max-w-md mx-auto">
                            {isSearch
                                ? "Try a nearby city or clear the destination above to see all packages."
                                : "Please check back soon — new trips are added regularly."}
                        </p>
                    </div>
                ) : (
                    <PackagesList items={items} />
                )}
            </div>

            <Footer />
        </>
    );
}
