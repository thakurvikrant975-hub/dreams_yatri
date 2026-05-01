// app/dashboard/page.tsx
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { SalesDashboard } from "./components/dashboard/Salesdashboard";
import { MarketingDashboard } from "./components/dashboard/Marketingdashboard";
import { DefaultDashboard } from "./components/dashboard/Defaultdashboard";

export default async function DashboardPage() {
  const member = await getCurrentMember();

  // Middleware already guarantees auth — if member is null here,
  // it means the DB has no record for this email (data issue, not auth issue)
  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-lg font-semibold">Account not found</p>
        <p className="text-sm text-muted-foreground">
          Your session is valid but no team member record exists for this email.
          Contact your administrator.
        </p>
      </div>
    );
  }

  const dept = member.department?.name?.toLowerCase() ?? "";

  if (dept === "sales")     return <SalesDashboard member={member} />;
  if (dept === "marketing") return <MarketingDashboard member={member} />;

  return <DefaultDashboard member={member} />;
}