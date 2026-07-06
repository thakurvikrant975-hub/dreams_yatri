import { LayoutGrid, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { getRoles } from "../actions";
import { PageAccessEditor } from "./PageAccessEditor";

export default async function PageAccessPage() {
    const roles = await getRoles();

    return (
        <div className="space-y-6">

            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/roles-and-permissions">
                            Roles & Permissions
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Page Access</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Page Access Control"
                description="Select which roles can see which pages in the dashboard"
                icon={LayoutGrid}
            />

            {/* Tabs */}
            <div className="flex gap-1 border-b">
                <Link
                    href="/dashboard/roles-and-permissions"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 -mb-px transition-colors"
                >
                    <ShieldCheck className="h-4 w-4" />
                    Roles & Data Access
                </Link>
                <Link
                    href="/dashboard/roles-and-permissions/page-access"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary -mb-px"
                >
                    <LayoutGrid className="h-4 w-4" />
                    Page Access
                </Link>
            </div>

            <PageAccessEditor roles={roles} />

        </div>
    );
}
