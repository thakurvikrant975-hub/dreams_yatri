import type { Metadata } from "next";
import VerifyHotelsClient from "./VerifyHotelsClient";

export const metadata: Metadata = {
    title: "Verify Hotels - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS  = [10, 20, 50] as const;
const VALID_URGENCY = ["all", "urgent", "overdue", "confirmed", "pending"] as const;

export default async function VerifyHotelsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp      = await searchParams;
    const page    = Math.max(1, parseInt(sp.page   ?? "1",  10) || 1);
    const rawLim  = parseInt(sp.limit ?? "20", 10);
    const limit   = (VALID_LIMITS  as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search  = (sp.search  ?? "").trim();
    const urgency = (VALID_URGENCY as readonly string[]).includes(sp.urgency ?? "")
        ? (sp.urgency as typeof VALID_URGENCY[number])
        : "all";

    return (
        <VerifyHotelsClient
            page={page}
            limit={limit}
            search={search}
            urgency={urgency}
        />
    );
}
