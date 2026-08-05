import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getHotelApprovalDetail, getHotelApprovalHistory } from "../actions";
import { HotelReviewClient } from "./HotelReviewClient";

export const metadata: Metadata = {
    title: "Review Hotel - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function HotelApprovalDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const hotelId = parseInt(id, 10);
    if (!Number.isFinite(hotelId) || hotelId <= 0) notFound();

    const [detail, history] = await Promise.all([
        getHotelApprovalDetail(hotelId),
        getHotelApprovalHistory(hotelId),
    ]);
    if (!detail) notFound();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotel-approvals">Hotel Approvals</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>{detail.name}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <HotelReviewClient detail={detail} history={history} />
        </div>
    );
}
