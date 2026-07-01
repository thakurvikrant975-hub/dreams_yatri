import type { Metadata } from "next";
import { LocationsClient } from "./LocationsClient";
import type { LocationTypeValue } from "@/app/lib/validators/locations";

export const metadata: Metadata = {
    title: "Locations - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

const VALID_LIMITS = [10, 20, 50] as const;

export default async function LocationsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page   = Math.max(1, parseInt(sp.page  ?? "1",  10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const type   = (sp.type ?? "all") as LocationTypeValue | "all";
    const scope  = (sp.scope === "all" ? "all" : "used") as "used" | "all";
    const status = (["active", "inactive"].includes(sp.status ?? "")
        ? sp.status
        : "all") as "active" | "inactive" | "all";

    return (
        <LocationsClient
            page={page}
            limit={limit}
            search={search}
            type={type}
            scope={scope}
            status={status}
        />
    );
}
