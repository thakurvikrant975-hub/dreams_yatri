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

export default async function ActivityCategoriesPage() {
    const { categories } = await getCategories();
    return <CategoriesClient initialCategories={categories} />;
}
