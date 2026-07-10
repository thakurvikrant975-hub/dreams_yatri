// app/dashboard/page.tsx
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { SalesDashboard } from "./components/dashboard/Salesdashboard";
import { MarketingDashboard } from "./components/dashboard/Marketingdashboard";
import { DefaultDashboard } from "./components/dashboard/Defaultdashboard";
import { DataEntryDashboard } from "./components/dashboard/DataEntryDashboard";
import { TravelExpertDashboard } from "./components/dashboard/TravelExpertDashboard";
import { InventoryManagerDashboard } from "./components/dashboard/InventoryManagerDashboard";
import { PlatformManagerDashboard } from "./components/dashboard/PlatformManagerDashboard";
import { HotelDepartmentDashboard } from "./components/dashboard/HotelDepartmentDashboard";
import { CabDepartmentDashboard } from "./components/dashboard/CabDepartmentDashboard";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import { CurrentMember } from "@/app/types/members";


type DashboardComponent = React.ComponentType<{ member: CurrentMember }>;

const ROLE_DASHBOARD_MAP: Record<string, DashboardComponent> = {
  "sales executive": SalesDashboard,
  marketing: MarketingDashboard,
  "data entry executive": DataEntryDashboard,
  "data entry operator": DataEntryDashboard,
  "travel expert": TravelExpertDashboard,
  "inventory manager": InventoryManagerDashboard,
  "platform manager": PlatformManagerDashboard,
  "hotel department": HotelDepartmentDashboard,
  "cab department": CabDepartmentDashboard,
};

export default async function DashboardPage() {
  const ctx = await getEffectiveMember();

  if (!ctx) {
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

  // Use the effective member (impersonated target for FSD, or real member otherwise)
  const { member } = ctx;

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