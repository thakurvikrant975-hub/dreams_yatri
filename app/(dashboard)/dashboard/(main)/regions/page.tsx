import RegionsPage from "./RegionsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Regions - Dashboard",
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
  const { page: pageParam } = await searchParams;

  const page = Math.max(1, Number(pageParam) || 1);

  return <RegionsPage page={page} />;
}