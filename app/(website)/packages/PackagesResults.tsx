import { searchPackages } from "@/app/actions/search/search-packages";
import { Heading } from "@/app/components/ui/Typography";
import PackagesList from "./PackagesList";

interface Props {
    to: string;
    toName: string;
    adults: number;
    childAges: number[];
    travelDate: string | null;
}

export default async function PackagesResults({ to, toName, adults, childAges, travelDate }: Props) {
    const { items } = await searchPackages({
        toLocationId: to || undefined,
        adults,
        childAges,
        travelDate,
    });

    const isSearch = Boolean(to);
    const heading = isSearch
        ? (items.length > 0
            ? `${items.length} package${items.length !== 1 ? "s" : ""} near ${toName || "you"}`
            : `Packages near ${toName || "you"}`)
        : "All Holiday Packages";

    return (
        <>
            <Heading level={2} weight="semibold" className="mb-7">{heading}</Heading>

            {items.length === 0 ? (
                <div className="py-16 text-center">
                    <p className="text-base font-semibold text-primary">
                        {isSearch
                            ? `No packages found near ${toName || "this location"}`
                            : "No packages available yet"}
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
        </>
    );
}
