import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { getAdsDashboard, defaultAdsRange } from "./actions";
import { AdsPerformanceClient } from "./AdsPerformanceClient";

export const metadata: Metadata = {
  title: "Ads Performance - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** Spend comes from Google, leads and outcomes from our own tables — the page
 * that finally puts the two beside each other. Range lives in the URL, so a
 * particular view can be shared or bookmarked. */
export default async function AdsPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const fallback = defaultAdsRange();
  const valid = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  let from = valid(sp.from) ?? fallback.from;
  let to = valid(sp.to) ?? fallback.to;
  if (from > to) [from, to] = [to, from];

  const data = await getAdsDashboard(from, to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ads Performance"
        description="What Google Ads costs, and what it produces — campaign by campaign, ad group by ad group."
        icon={Megaphone}
      />
      <AdsPerformanceClient data={data} />
    </div>
  );
}
