import CategoriesPage from "./CategoriesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Categories - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return <CategoriesPage searchParams={searchParams} />;
}