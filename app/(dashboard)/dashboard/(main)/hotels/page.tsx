import type { Metadata } from "next";
import { HotelsPageServer } from "./HotelPageClient";
import type { HotelApprovalFilter } from "./actions";

export const metadata: Metadata = {
    title: "Hotels - Dashboard",
    description: "Hotels",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_NEAR_SORT = ["distance", "price"] as const;

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page  = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const status = (["active", "inactive"].includes(sp.status ?? "")
        ? sp.status : "all") as "active" | "inactive" | "all";
    const rawDest    = sp.destination ?? "all";
    const destination = rawDest === "all" ? ("all" as const) : ((parseInt(rawDest, 10) || "all") as number | "all");
    const category    = sp.category ?? "all";
    const approval = (["pending", "approved", "changes"].includes(sp.approval ?? "")
        ? sp.approval : "all") as HotelApprovalFilter;

    // "Near a location" mode — an alternative to text search, picked from the
    // map/location catalog rather than typed. Same pattern as hotel-inventory.
    const nearLat = parseFloat(sp.nearLat ?? "");
    const nearLng = parseFloat(sp.nearLng ?? "");
    const near = (sp.nearName && Number.isFinite(nearLat) && Number.isFinite(nearLng))
        ? { id: sp.nearId ?? "0", name: sp.nearName, type: sp.nearType ?? "CITY", lat: nearLat, lng: nearLng }
        : null;
    const nearSort = (VALID_NEAR_SORT as readonly string[]).includes(sp.nearSort ?? "")
        ? (sp.nearSort as typeof VALID_NEAR_SORT[number])
        : "distance";
    const uploadedBy = (sp.uploadedBy ?? "all").trim() || "all";

    return (
        <HotelsPageServer
            page={page}
            limit={limit}
            search={search}
            status={status}
            destination={destination}
            category={category}
            approval={approval}
            near={near}
            nearSort={nearSort}
            uploadedBy={uploadedBy}
        />
    );
}
