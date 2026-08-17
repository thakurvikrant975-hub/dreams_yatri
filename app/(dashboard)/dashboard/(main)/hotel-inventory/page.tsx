import type { Metadata } from "next";
import HotelInventoryClient from "./HotelInventoryClient";

export const metadata: Metadata = {
    title: "Hotel Inventory - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_STATUS = ["all", "active", "inactive"] as const;
const VALID_NEAR_SORT = ["distance", "price"] as const;

export default async function HotelInventoryPage({
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

    // "Near a location" mode — an alternative to text search, picked from the
    // map/location catalog rather than typed. See HotelInventoryTable for the
    // picker and getHotels for the distance ranking.
    const nearLat = parseFloat(sp.nearLat ?? "");
    const nearLng = parseFloat(sp.nearLng ?? "");
    const near = (sp.nearName && Number.isFinite(nearLat) && Number.isFinite(nearLng))
        ? { id: sp.nearId ?? "0", name: sp.nearName, type: sp.nearType ?? "CITY", lat: nearLat, lng: nearLng }
        : null;
    const nearSort = (VALID_NEAR_SORT as readonly string[]).includes(sp.nearSort ?? "")
        ? (sp.nearSort as typeof VALID_NEAR_SORT[number])
        : "distance";
    const uploadedBy = (sp.uploadedBy ?? "all").trim() || "all";
    const category = (sp.category ?? "all").trim() || "all";

    return (
        <HotelInventoryClient
            page={page}
            limit={limit}
            search={search}
            status={status}
            near={near}
            nearSort={nearSort}
            uploadedBy={uploadedBy}
            category={category}
        />
    );
}
