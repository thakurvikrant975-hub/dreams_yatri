import type { Metadata } from "next";
import HotelRequestsClient from "./HotelRequestsClient";

export const metadata: Metadata = {
    title: "Hotel Requests - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;

export default async function HotelRequestsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();

    return <HotelRequestsClient page={page} limit={limit} search={search} />;
}
