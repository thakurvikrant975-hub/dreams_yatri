// FILE: /dashboard/roles-and-permissions/[id]/permissions/page.tsx

import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb";
import { getRoleById } from "../../actions";
import { PermissionPage } from "../../PermissionPage";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function RolePermissionsPage({ params }: Props) {
    const { id } = await params;
    const role = await getRoleById(id);

    if (!role) notFound();

    return (
        <div className="space-y-6">

            {/* Breadcrumb */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            href="/dashboard"
                            className="text-dashboard-base-content/50 hover:text-dashboard-primary transition-colors"
                        >
                            Dashboard
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-dashboard-base-content/30" />
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            href="/dashboard/roles-and-permissions"
                            className="text-dashboard-base-content/50 hover:text-dashboard-primary transition-colors"
                        >
                            Roles & Permissions
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-dashboard-base-content/30" />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="flex items-center gap-1.5 text-dashboard-base-content font-medium">
                            <ShieldCheck className="h-3.5 w-3.5 text-dashboard-primary" />
                            {role.name}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Full permission editor */}
            <PermissionPage role={role} />

        </div>
    );
}