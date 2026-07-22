import type { Metadata } from "next";
import ExpiringRatesClient from "./ExpiringRatesClient";
import { isExpiryWindow, type ExpiryWindow } from "./actions";

export const metadata: Metadata = {
    title: "Expiring Seasonal Rates - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const DEFAULT_WINDOW: ExpiryWindow = "3m";

export default async function ExpiringRatesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const window = isExpiryWindow(sp.window ?? "") ? (sp.window as ExpiryWindow) : DEFAULT_WINDOW;

    return (
        <ExpiringRatesClient
            page={page}
            limit={limit}
            search={search}
            window={window}
        />
    );
}
