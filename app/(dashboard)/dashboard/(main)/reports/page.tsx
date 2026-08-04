import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "../components/dashboard/PageHeader";
import { getReportsData } from "./actions";
import { ReportsClient } from "./ReportsClient";
import type { TimePeriod } from "./actions";

export const metadata: Metadata = {
  title: "Reports - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_PERIODS: TimePeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "current_month",
  "last_month",
  "custom",
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    dept?: string;
  }>;
}) {
  const sp = await searchParams;
  const period: TimePeriod =
    (VALID_PERIODS as string[]).includes(sp.period ?? "")
      ? (sp.period as TimePeriod)
      : "today";

  const data = await getReportsData(period, sp.from, sp.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Department-wise work tracker — hotels, cabs, and travel content by team member"
        icon={ClipboardList}
      />
      <ReportsClient
        data={data}
        initialPeriod={period}
        initialFrom={sp.from}
        initialTo={sp.to}
        initialDept={(sp.dept as "hotel" | "cab" | "travel" | "sales") ?? "sales"}
      />
    </div>
  );
}
