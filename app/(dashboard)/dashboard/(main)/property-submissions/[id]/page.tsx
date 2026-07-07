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
    const detail = {
        ...raw,
        latitude: raw.latitude != null ? Number(raw.latitude) : null,
        longitude: raw.longitude != null ? Number(raw.longitude) : null,
        prop_base_rate: raw.prop_base_rate != null ? Number(raw.prop_base_rate) : null,
        prop_extra_adult: raw.prop_extra_adult != null ? Number(raw.prop_extra_adult) : null,
        prop_child_rate: raw.prop_child_rate != null ? Number(raw.prop_child_rate) : null,
        hotelRooms: raw.hotelRooms.map((r) => ({
            ...r,
            pricing: r.pricing.map((p) => ({
                ...p,
                price_per_night: Number(p.price_per_night),
                gst_percentage: Number(p.gst_percentage),
            })),
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
