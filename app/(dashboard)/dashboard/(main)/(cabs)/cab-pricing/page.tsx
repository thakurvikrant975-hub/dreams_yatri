import CabPricingClient from "./CabPricingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cab Pricing - Dashboard",
  description: "",
  robots: {
    index: false, follow: false, nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const VALID_STATUSES = ["active", "inactive", "all"] as const;
const VALID_LIMITS   = [10, 20, 50] as const;

type Status = (typeof VALID_STATUSES)[number];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; limit?: string; search?: string; status?: string;
  }>;
}) {
  const p = await searchParams;

  const page    = Math.max(1, Number(p.page) || 1);
  const limitRaw = Number(p.limit);
  const limit   = (VALID_LIMITS as readonly number[]).includes(limitRaw)
    ? (limitRaw as 10 | 20 | 50)
    : 10;
  const search = p.search ?? "";
  const status = (VALID_STATUSES as readonly string[]).includes(p.status ?? "")
    ? (p.status as Status)
    : "all";

  return (
    <CabPricingClient
      page={page}
      limit={limit}
      search={search}
      status={status}
    />
  );
}
