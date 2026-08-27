import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { getLeadRequestsQueue } from "./actions";
import { LeadRequestsClient } from "./LeadRequestsClient";

export const metadata: Metadata = {
    title: "Lead Requests - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function LeadRequestsPage() {
    const requests = await getLeadRequestsQueue();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Lead Requests</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Lead Requests"
                description="Leads sales executives have asked to add — review, and accept into the pipeline"
                icon={ClipboardCheck}
            />

            <LeadRequestsClient requests={requests} />
        </div>
    );
}
