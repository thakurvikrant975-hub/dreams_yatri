import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { getMyLeadRequests } from "../lead-requests/actions";
import { getDestinationsForQuery } from "../(marketing)/queries/actions";
import { RequestLeadForm } from "./RequestLeadForm";

export const metadata: Metadata = {
    title: "Request a Lead - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function RequestLeadPage() {
    const [requests, destinations] = await Promise.all([
        getMyLeadRequests(),
        getDestinationsForQuery(),
    ]);

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Request a Lead</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Request a Lead"
                description="Got a client the lead manager should add? Send it over for review."
                icon={UserPlus}
            />

            <RequestLeadForm requests={requests} destinations={destinations} />
        </div>
    );
}
