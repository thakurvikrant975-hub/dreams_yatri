// app/dashboard/components/MarketingDashboard.tsx
// Stub — build this next after SalesDashboard is live
import type { CurrentMember } from "@/app/types/members";
import { DefaultDashboard } from "./Defaultdashboard";

interface MarketingDashboardProps {
  member: CurrentMember;
}

export function MarketingDashboard({ member }: MarketingDashboardProps) {
  // Replace this with the real MarketingDashboard implementation
  return <DefaultDashboard member={member} />;
}