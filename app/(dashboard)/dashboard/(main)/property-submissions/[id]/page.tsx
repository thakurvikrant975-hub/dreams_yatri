import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getSubmissionDetail, startReview } from "../actions";
import { SubmissionReviewClient } from "./SubmissionReviewClient";

export const metadata: Metadata = {
    title: "Review Property - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function PropertySubmissionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const hotelId = parseInt(id, 10);
    if (!Number.isFinite(hotelId) || hotelId <= 0) notFound();

    const raw = await getSubmissionDetail(hotelId);
    if (!raw) notFound();

    // First admin to open a SUBMITTED property claims it for review.
    if (raw.listing_status === "SUBMITTED") {
        await startReview(hotelId);
        raw.listing_status = "UNDER_REVIEW";
    }

    // Prisma Decimal fields aren't plain-serializable across the RSC boundary —
    // convert to numbers before handing off to the client component.
    const numOrNull = (v: unknown) => (v != null ? Number(v) : null);
    const detail = {
        ...raw,
        latitude: numOrNull(raw.latitude),
        longitude: numOrNull(raw.longitude),
        prop_base_rate: numOrNull(raw.prop_base_rate),
        prop_extra_adult: numOrNull(raw.prop_extra_adult),
        prop_child_rate: numOrNull(raw.prop_child_rate),
        hotelRooms: raw.hotelRooms.map((r) => ({
            ...r,
            pricing: r.pricing.map((p) => ({
                ...p,
                price_per_night: Number(p.price_per_night),
                original_price: numOrNull(p.original_price),
                extra_bed_rate: numOrNull(p.extra_bed_rate),
                extra_child_rate: numOrNull(p.extra_child_rate),
                gst_percentage: Number(p.gst_percentage),
                occupancy_prices: p.occupancy_prices.map((o) => ({
                    ...o,
                    price_per_night: Number(o.price_per_night),
                    original_price: numOrNull(o.original_price),
                })),
                seasons: p.seasons.map((s) => ({
                    ...s,
                    price_per_night: Number(s.price_per_night),
                    weekend_price_per_night: numOrNull(s.weekend_price_per_night),
                    original_price: numOrNull(s.original_price),
                    extra_bed_rate: numOrNull(s.extra_bed_rate),
                    extra_child_rate: numOrNull(s.extra_child_rate),
                    occupancy_prices: s.occupancy_prices.map((o) => ({
                        ...o,
                        price_per_night: Number(o.price_per_night),
                        original_price: numOrNull(o.original_price),
                    })),
                })),
            })),
        })),
        meal_pricing: raw.meal_pricing.map((m) => ({
            ...m,
            price: Number(m.price),
            weekend_price: numOrNull(m.weekend_price),
            veg_price: numOrNull(m.veg_price),
            non_veg_price: numOrNull(m.non_veg_price),
            seasons: m.seasons.map((s) => ({
                ...s,
                price: Number(s.price),
                weekend_price: numOrNull(s.weekend_price),
            })),
        })),
        addons: raw.addons.map((a) => ({
            ...a,
            price: Number(a.price),
            weekend_price: numOrNull(a.weekend_price),
        })),
    };

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/property-submissions">Property Submissions</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>{detail.name}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <SubmissionReviewClient detail={detail} />
        </div>
    );
}
