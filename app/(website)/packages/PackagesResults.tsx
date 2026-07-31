import { searchPackages } from "@/app/actions/search/search-packages";
import { Heading } from "@/app/components/ui/Typography";
import {
  countActivePackageFilters,
  type PackageFilters,
} from "@/app/lib/packages/packageFacets";
import PackagesList from "./PackagesList";

interface Props {
    to: string;
    toName: string;
    adults: number;
    childAges: number[];
    travelDate: string | null;
    filters: PackageFilters;
}

export default async function PackagesResults({ to, toName, adults, childAges, travelDate, filters }: Props) {
    const { items, capped } = await searchPackages({
        toLocationId: to || undefined,
        adults,
        childAges,
        travelDate,
        filters,
    });

    const isSearch = Boolean(to);
    const isFiltered = countActivePackageFilters(filters) > 0;
    const count = `${items.length} package${items.length !== 1 ? "s" : ""}`;

    const heading = isSearch
        ? (items.length > 0
            ? `${count} near ${toName || "you"}`
            : `Packages near ${toName || "you"}`)
        : isFiltered
            ? (items.length > 0 ? `${count} match your filters` : "No matching packages")
            : "All Holiday Packages";

    return (
        <>
            <Heading level={2} weight="semibold" className="mb-7">{heading}</Heading>

            {items.length === 0 ? (
                <div className="py-16 text-center">
                    <p className="text-base font-semibold text-primary">
                        {isFiltered
                            ? "No packages match these filters"
                            : isSearch
                                ? `No packages found near ${toName || "this location"}`
                                : "No packages available yet"}
                    </p>
                    <p className="text-sm text-secondary mt-1 max-w-md mx-auto">
                        {isFiltered
                            ? "Try widening your budget or removing a filter or two."
                            : isSearch
                                ? "Try a nearby city or clear the destination above to see all packages."
                                : "Please check back soon — new trips are added regularly."}
                    </p>
                </div>
            ) : (
                <>
                    <PackagesList items={items} />
                    {capped && (
                        <p className="mt-8 text-center text-xs text-neutral-400">
                            Showing the closest matches — narrow the destination or duration to see more.
                        </p>
                    )}
                </>
            )}
        </>
    );
}
