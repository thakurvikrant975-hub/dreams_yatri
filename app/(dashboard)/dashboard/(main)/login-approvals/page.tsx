import { ShieldCheck } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getPendingLoginApprovals } from "./actions";
import { LoginApprovalsClient } from "./LoginApprovalsClient";

export default async function LoginApprovalsPage() {
    const requests = await getPendingLoginApprovals();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard" className="text-dashboard-base-content/50 hover:text-dashboard-primary transition-colors">
                            Dashboard
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-dashboard-base-content/30" />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="flex items-center gap-1.5 text-dashboard-base-content font-medium">
                            <ShieldCheck className="h-3.5 w-3.5 text-dashboard-primary" />
                            Login Approvals
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div>
                <h1 className="text-lg font-semibold">Login Approvals</h1>
                <p className="text-sm text-dashboard-base-content/60">
                    Late logins (past 10:05 AM) and re-logins after an inactivity auto-logout wait here for sign-off.
                </p>
            </div>

            <LoginApprovalsClient initialRequests={requests} />
        </div>
    );
}
