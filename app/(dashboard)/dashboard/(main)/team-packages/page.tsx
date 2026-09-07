import type { Metadata } from "next";
import TeamPackagesClient from "./TeamPackagesClient";

export const metadata: Metadata = {
    title: "Team Packages - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_FILTERS = ["all", "pending", "verified", "rejected"] as const;

export default async function TeamPackagesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    // Defaults to "pending" rather than "all" — the queue's job is to surface
    // what still needs review; a Team Leader/Sales Manager opening this page
    // wants to see what's waiting on them, not their whole history.
    const filter = (VALID_FILTERS as readonly string[]).includes(sp.filter ?? "")
        ? (sp.filter as typeof VALID_FILTERS[number])
        : "pending";
    const destination = (sp.destination ?? "").trim();
    const from = (sp.from ?? "").trim();
    const to   = (sp.to ?? "").trim();
    const minPrice = sp.minPrice ? Number(sp.minPrice) : null;

    return (
        <TeamPackagesClient
            page={page}
            limit={limit}
            search={search}
            filter={filter}
            destination={destination}
            from={from}
            to={to}
            minPrice={minPrice}
        />
    );
}
