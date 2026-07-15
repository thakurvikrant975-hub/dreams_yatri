import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { PageHeader } from "../components/dashboard/PageHeader";
import { PlatformManagerAnalytics } from "../components/dashboard/PlatformManagerAnalytics";
import { GeneralAnalytics } from "../components/dashboard/GeneralAnalytics";
import { HotelDepartmentAnalytics } from "../components/dashboard/HotelDepartmentAnalytics";
import { getPlatformManagerAnalytics } from "../actions/platform-manager-analytics-actions";
import { getGeneralAnalytics } from "../actions/general-analytics-actions";
import { getHotelDepartmentAnalytics } from "../actions/hotel-department-analytics-actions";
import type { CurrentMember } from "@/app/types/members";

export const metadata: Metadata = {
  title: "Analytics - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

type SectionProps = { member: CurrentMember; from: string; to: string };
type AnalyticsSection = (props: SectionProps) => Promise<React.ReactElement>;

async function PlatformManagerAnalyticsSection({ from, to }: SectionProps) {
  const data = await getPlatformManagerAnalytics(from, to);
  return <PlatformManagerAnalytics data={data} from={from} to={to} />;
}

async function GeneralAnalyticsSection({ from, to }: SectionProps) {
  const data = await getGeneralAnalytics(from, to);
  return <GeneralAnalytics data={data} from={from} to={to} />;
}

async function HotelDepartmentAnalyticsSection({ from, to }: SectionProps) {
  const data = await getHotelDepartmentAnalytics(from, to);
  return <HotelDepartmentAnalytics data={data} from={from} to={to} />;
}

// Add more entries here as per-role views are built, mirroring ROLE_DASHBOARD_MAP
// in dashboard/page.tsx. Every other role (and members with no team role at
// all) sees general site analytics.
const ANALYTICS_MAP: Record<string, AnalyticsSection> = {
  "platform manager": PlatformManagerAnalyticsSection,
  "hotel department": HotelDepartmentAnalyticsSection,
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [ctx, sp] = await Promise.all([getEffectiveMember(), searchParams]);

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

  const { member } = ctx;
  const from = sp.from ?? todayStr();
  const to = sp.to ?? todayStr();

  const identifier =
    member.teamRole?.name?.toLowerCase() ||
    member.department?.name?.toLowerCase() ||
    "";

  const Section = ANALYTICS_MAP[identifier] ?? GeneralAnalyticsSection;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={
          ANALYTICS_MAP[identifier]
            ? "Team activity report — who did what, and when"
            : "Site-wide performance overview"
        }
        icon={BarChart3}
      />
      <Section member={member} from={from} to={to} />
    </div>
  );
}
