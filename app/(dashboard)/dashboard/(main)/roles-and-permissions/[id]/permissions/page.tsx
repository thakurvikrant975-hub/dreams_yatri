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
                        <BreadcrumbPage className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" />
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