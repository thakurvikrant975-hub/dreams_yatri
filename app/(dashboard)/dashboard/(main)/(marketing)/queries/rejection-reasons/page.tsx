import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { getAllRejectionReasons } from "../actions";
import { RejectionReasonsManager } from "./RejectionReasonsManager";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb";
import { PageHeader } from "../../../components/dashboard/PageHeader";

export const metadata: Metadata = {
    title: "Rejection Reasons - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function RejectionReasonsPage() {
    const reasons = await getAllRejectionReasons();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/queries">Queries</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Rejection Reasons</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Rejection Reasons"
                description="Manage the reasons available when rejecting a query or a package's pricing"
                icon={XCircle}
            />

            <RejectionReasonsManager reasons={reasons} />
        </div>
    );
}
