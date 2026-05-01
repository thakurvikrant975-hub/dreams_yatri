// app/dashboard/page.tsx
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { SalesDashboard } from "./components/dashboard/Salesdashboard";
import { MarketingDashboard } from "./components/dashboard/Marketingdashboard";
import { DefaultDashboard } from "./components/dashboard/Defaultdashboard";
import DashboardHeader from "./components/dashboard/DashboardHeader";


export default async function DashboardPage() {
  const member = await getCurrentMember();

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

  // Route by role name since department is not yet assigned in DB
  // Falls back to department name if role is missing
  const role = member.teamRole?.name?.toLowerCase() ?? "";
  const dept = member.department?.name?.toLowerCase() ?? "";
  const identifier = role || dept;

  if (identifier === "sales") {
    return (
      <>
        <DashboardHeader member={member} />
        <SalesDashboard member={member} />
      </>
    );
  }
  if (identifier === "marketing") {
    return (
      <>
        <DashboardHeader member={member} />
        <MarketingDashboard member={member} />
      </>
    );
  }

  return (
    <>
      <DashboardHeader member={member} />
      <DefaultDashboard member={member} />
    </>
  );
}