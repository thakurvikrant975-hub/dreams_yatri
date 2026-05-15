import RegionsPage from "./RegionsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Regions - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

const VALID_STATUSES   = ["active", "inactive", "all"] as const;
const VALID_DEST_COUNTS = ["0", "1-5", "6-15", "15+", "all"] as const;
const VALID_LIMITS     = [10, 20, 50] as const;

type Status    = (typeof VALID_STATUSES)[number];
type DestCount = (typeof VALID_DEST_COUNTS)[number];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; limit?: string; search?: string;
    country?: string; status?: string; destCount?: string;
  }>;
}) {
  const p = await searchParams;

  const page      = Math.max(1, Number(p.page) || 1);
  const limitRaw  = Number(p.limit);
  const limit     = (VALID_LIMITS as readonly number[]).includes(limitRaw)
    ? (limitRaw as 10 | 20 | 50)
    : 10;
  const search    = p.search   ?? "";
  const country   = p.country  ?? "";
  const status    = (VALID_STATUSES   as readonly string[]).includes(p.status   ?? "")
    ? (p.status   as Status)    : "all";
  const destCount = (VALID_DEST_COUNTS as readonly string[]).includes(p.destCount ?? "")
    ? (p.destCount as DestCount) : "all";

  return (
    <RegionsPage
      page={page}
      limit={limit}
      search={search}
      country={country}
      status={status}
      destCount={destCount}
    />
  );
}
