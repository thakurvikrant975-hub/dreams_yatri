import type { Metadata } from "next";
import { ActivitiesClient } from "./ActivityClient";

export const metadata: Metadata = {
    title: "Activities - Dashboard",
    description: "",
    robots: {
        index:     false,
        follow:    false,
        nocache:   true,
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

    const page   = Math.max(1, parseInt(sp.page  ?? "1",  10) || 1);
    const rawLim = parseInt(sp.limit ?? "10", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 10;
    const search = (sp.search ?? "").trim();
    const status = (["active", "inactive"].includes(sp.status ?? "")
        ? sp.status : "all") as "active" | "inactive" | "all";

    const rawCat     = sp.category_id ?? "all";
    const category_id = rawCat === "all"
        ? ("all" as const)
        : ((parseInt(rawCat, 10) || "all") as number | "all");

    return (
        <ActivitiesClient
            page={page}
            limit={limit}
            search={search}
            status={status}
            category_id={category_id}
        />
    );
}
