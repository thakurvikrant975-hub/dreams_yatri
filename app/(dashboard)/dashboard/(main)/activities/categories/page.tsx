import type { Metadata } from "next";
import { getCategories } from "./actions";
import { CategoriesClient } from "./CategoriesClient";

export const metadata: Metadata = {
    title: "Activity Categories - Dashboard",
    robots: {
        index:     false,
        follow:    false,
        nocache:   true,
        googleBot: { index: false, follow: false },
    },
};

type Status = "active" | "inactive" | "all";

export default async function ActivityCategoriesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const search = typeof params.search === "string" ? params.search : "";
    const status = (["active", "inactive"].includes(params.status as string)
        ? params.status
        : "all") as Status;

    const { categories, totalCount } = await getCategories({ search, status });

    return (
        <CategoriesClient
            initialCategories={categories}
            totalCount={totalCount}
            search={search}
            status={status}
        />
    );
}
