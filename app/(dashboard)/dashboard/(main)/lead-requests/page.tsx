import type { Metadata } from "next";
import LeadRequestsClient from "./LeadRequestsClient";

export const metadata: Metadata = {
    title: "Lead Requests - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_FILTERS = ["all", "pending", "accepted", "rejected"] as const;

export default async function LeadRequestsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const filter = (VALID_FILTERS as readonly string[]).includes(sp.filter ?? "")
        ? (sp.filter as typeof VALID_FILTERS[number])
        : "all";

    return (
        <LeadRequestsClient
            page={page}
            limit={limit}
            search={search}
            filter={filter}
        />
    );
}
