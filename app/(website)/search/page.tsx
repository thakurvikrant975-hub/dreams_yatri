import type { Metadata } from "next";
import { searchPackages } from "@/app/actions/search/search-packages";
import type { LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { Heading, Text } from "@/app/components/ui/Typography";
import SearchResultsList from "./SearchResultsList";
import SearchEditBar from "./SearchEditBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Search Holiday Packages | Dreams Yatri",
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

// Reconstruct a LocationValue from URL params for the editable search bar.
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

export default async function SearchPage({
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

    // Initial values for the editable search bar
    const parsedDate = date ? new Date(`${date}T00:00:00`) : null;
    const initialDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
    const editBar = (
        <SearchEditBar
            initialFrom={toLocationValue(from, fromName, fromType)}
            initialTo={toLocationValue(to, toName, toType)}
            initialDate={initialDate}
            initialTravellers={{ adults, childrenAges: childAges }}
        />
    );

    // No destination chosen — show the editable bar + a prompt
    if (!to) {
        return (
            <>
                {editBar}
                <div className="screen-space py-24 flex flex-col items-center text-center">
                    <Heading level={2} weight="semibold">Where do you want to go?</Heading>
                    <Text size="sm" intent="secondary" className="mt-2 max-w-md">
                        Choose a destination above and hit Search to find holiday packages.
                    </Text>
                </div>
            </>
        );
    }

    const { items } = await searchPackages({
        toLocationId: to,
        adults,
        childAges,
        travelDate: date || null,
    });

    return (
        <>
            {editBar}

            <div className="screen-space py-8">
                <Heading level={2} weight="semibold">
                    {items.length > 0
                        ? `${items.length} package${items.length !== 1 ? "s" : ""} near ${toName || "you"}`
                        : `Packages near ${toName || "you"}`}
                </Heading>
                <Text size="sm" intent="secondary" className="mt-1 mb-7 block">
                    Prices shown for {travellers}{dateLabel ? ` · ${dateLabel}` : ""}
                </Text>

                {items.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-base font-semibold text-primary">No packages found near {toName || "this location"}</p>
                        <p className="text-sm text-secondary mt-1 max-w-md mx-auto">
                            We don&apos;t have curated trips here yet. Try a nearby city or a different destination above.
                        </p>
                    </div>
                ) : (
                    <SearchResultsList items={items} />
                )}
            </div>
        </>
    );
}
