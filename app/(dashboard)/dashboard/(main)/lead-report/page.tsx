import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { PageHeader } from "../components/dashboard/PageHeader";
import { getLeadReport, dateToIstLocal } from "./actions";
import { LeadReportClient } from "./LeadReportClient";

export const metadata: Metadata = {
  title: "Lead Report - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** Default window: midnight IST this morning through right now — the most
 * common way the report is run, with the picker free to widen it to
 * "yesterday 11am to today 3pm" or narrow it to a single afternoon. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const todayLocal = dateToIstLocal(now);
  return { from: `${todayLocal.slice(0, 10)}T00:00`, to: todayLocal };
}

export default async function LeadReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [ctx, sp] = await Promise.all([getEffectiveMember(), searchParams]);

  const fallback = defaultRange();
  // The picker's own format is the URL format, so a hand-edited or shared
  // link only has to look like what the inputs produce.
  const valid = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : null);
  let from = valid(sp.from) ?? fallback.from;
  let to = valid(sp.to) ?? fallback.to;
  if (from > to) [from, to] = [to, from];

  const data = await getLeadReport(from, to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Report"
        description="Pick a time window and download the report as a PDF"
        icon={FileSpreadsheet}
      />
      <LeadReportClient data={data} generatedByName={ctx?.member.name} />
    </div>
  );
}
