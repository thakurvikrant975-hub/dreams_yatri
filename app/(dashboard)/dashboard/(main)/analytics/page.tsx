import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { PageHeader } from "../components/dashboard/PageHeader";
import { PlatformManagerAnalytics } from "../components/dashboard/PlatformManagerAnalytics";
import { GeneralAnalytics } from "../components/dashboard/GeneralAnalytics";
import { HotelDepartmentAnalytics } from "../components/dashboard/HotelDepartmentAnalytics";
import { LeadManagerAnalytics } from "../components/dashboard/LeadManagerAnalytics";
import { SalesManagerAnalytics } from "../components/dashboard/SalesManagerAnalytics";
import { TeamLeaderAnalytics } from "../components/dashboard/TeamLeaderAnalytics";
import { getPlatformManagerAnalytics } from "../actions/platform-manager-analytics-actions";
import { getGeneralAnalytics } from "../actions/general-analytics-actions";
import { getHotelDepartmentAnalytics } from "../actions/hotel-department-analytics-actions";
import { getLeadManagerAnalytics } from "../actions/lead-manager-analytics-actions";
import { getTeamLeaderAnalytics } from "../actions/team-leader-analytics-actions";
import { getSalesTeamAnalytics } from "../sales-teams/sales-team-analytics-actions";
import { getLeaderScope } from "@/app/lib/sales-teams/leader-scope";
import { istDayOffset } from "../lead-report/ist";
import { istYearMonth } from "@/app/lib/ist-window";
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

async function LeadManagerAnalyticsSection({ member, from, to }: SectionProps) {
  const data = await getLeadManagerAnalytics(from, to);
  return <LeadManagerAnalytics data={data} from={from} to={to} generatedByName={member.name} />;
}

async function SalesManagerAnalyticsSection({ from, to }: SectionProps) {
  const data = await getSalesTeamAnalytics(from, to);
  return <SalesManagerAnalytics data={data} from={from} to={to} />;
}

async function TeamLeaderAnalyticsSection({ from, to }: SectionProps) {
  const [teamData, leaderboard, scope] = await Promise.all([
    getTeamLeaderAnalytics(from, to),
    // Company-wide, same date range — every Team Leader sees every sales
    // executive's and every team's standing, not just their own team's.
    getSalesTeamAnalytics(from, to),
    getLeaderScope(),
  ]);
  return (
    <TeamLeaderAnalytics
      teamData={teamData}
      leaderboard={leaderboard}
      from={from}
      to={to}
      viewerTeamId={scope?.ledTeamId ?? null}
    />
  );
}

// Add more entries here as per-role views are built, mirroring ROLE_DASHBOARD_MAP
// in dashboard/page.tsx. Every other role (and members with no team role at
// all) sees general site analytics.
const ANALYTICS_MAP: Record<string, AnalyticsSection> = {
  "platform manager": PlatformManagerAnalyticsSection,
  "hotel department": HotelDepartmentAnalyticsSection,
  "lead manager": LeadManagerAnalyticsSection,
  "sales manager": SalesManagerAnalyticsSection,
  "team leader": TeamLeaderAnalyticsSection,
};

// The IST calendar day, not UTC's. toISOString() gave the UTC date, so
// between IST midnight and 5:30am the page defaulted to yesterday's report.
function todayStr() {
  return istDayOffset(0);
}

function monthStartStr() {
  const { year, month } = istYearMonth();
  return `${year}-${String(month).padStart(2, "0")}-01`;
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

  const identifier =
    member.teamRole?.name?.toLowerCase() ||
    member.department?.name?.toLowerCase() ||
    "";

  // Every other role defaults to "today" — but a Sales Manager's targets are
  // monthly, so opening the page to a single day next to a monthly target
  // reads as a near-empty report. Default that one role to month-to-date;
  // an explicit ?from=/&to= (e.g. from the range picker) still wins.
  const defaultFrom = identifier === "sales manager" ? monthStartStr() : todayStr();
  const from = sp.from ?? defaultFrom;
  const to = sp.to ?? todayStr();

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
