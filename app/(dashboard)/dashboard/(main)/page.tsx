// app/dashboard/page.tsx
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { SalesDashboard } from "./components/dashboard/Salesdashboard";
import { MarketingDashboard } from "./components/dashboard/Marketingdashboard";
import { DefaultDashboard } from "./components/dashboard/Defaultdashboard";
import { DataEntryDashboard } from "./components/dashboard/DataEntryDashboard";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import { CurrentMember } from "@/app/types/members";


type DashboardComponent = React.ComponentType<{ member: CurrentMember }>;

const ROLE_DASHBOARD_MAP: Record<string, DashboardComponent> = {
  sales: SalesDashboard,
  marketing: MarketingDashboard,
  "data entry executive": DataEntryDashboard,
  "data entry operator": DataEntryDashboard,
};

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

  const identifier =
    member.teamRole?.name?.toLowerCase() ||
    member.department?.name?.toLowerCase() ||
    "";

  const Dashboard = ROLE_DASHBOARD_MAP[identifier] ?? DefaultDashboard;

  return (
    <>
      <DashboardHeader member={member} />
      <Dashboard member={member} />
    </>
  );
}