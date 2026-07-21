import type { Metadata } from "next";
import CabInventoryClient from "./CabInventoryClient";

export const metadata: Metadata = {
    title: "Cab Inventory - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_STATUS = ["all", "active", "inactive"] as const;

export default async function CabInventoryPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const status = (VALID_STATUS as readonly string[]).includes(sp.status ?? "")
        ? (sp.status as typeof VALID_STATUS[number])
        : "all";

    return (
        <CabInventoryClient
            page={page}
            limit={limit}
            search={search}
            status={status}
        />
    );
}
