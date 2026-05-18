import type { Metadata } from "next";
import { HotelsPageServer } from "./HotelPageClient";

export const metadata: Metadata = {
    title: "Hotels - Dashboard",
    description: "Hotels",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

const VALID_LIMITS = [10, 20, 50] as const;

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page  = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const status = (["active", "inactive"].includes(sp.status ?? "")
        ? sp.status : "all") as "active" | "inactive" | "all";
    const rawDest    = sp.destination ?? "all";
    const destination = rawDest === "all" ? ("all" as const) : ((parseInt(rawDest, 10) || "all") as number | "all");
    const category    = sp.category ?? "all";

    return (
        <HotelsPageServer
            page={page}
            limit={limit}
            search={search}
            status={status}
            destination={destination}
            category={category}
        />
    );
}
