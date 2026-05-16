import type { Metadata } from "next";
import { DestinationsClient } from "./DestinationsClient";

export const metadata: Metadata = {
    title: "Destinations - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

const VALID_LIMITS = [10, 20, 50] as const;

export default async function DestinationsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page   = Math.max(1, parseInt(sp.page  ?? "1",  10) || 1);
    const rawLim = parseInt(sp.limit ?? "10", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 10;
    const search    = (sp.search ?? "").trim();
    const region_id = sp.region ? parseInt(sp.region, 10) || undefined : undefined;
    const status    = (["active", "inactive"].includes(sp.status ?? "")
        ? sp.status
        : "all") as "active" | "inactive" | "all";

    return (
        <DestinationsClient
            page={page}
            limit={limit}
            search={search}
            region_id={region_id}
            status={status}
        />
    );
}
