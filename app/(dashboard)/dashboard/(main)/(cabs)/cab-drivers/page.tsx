import type { Metadata } from "next";
import { getCabDrivers, getActiveVehiclesForDriver } from "./actions";
import { CabDriversClient } from "./CabDriversClient";

export const metadata: Metadata = {
  title: "Cab Drivers - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS    = [10, 20, 50] as const;
const VALID_STATUSES  = ["active", "inactive", "all"] as const;
const VALID_VERIFIED  = ["verified", "unverified", "all"] as const;
type Status   = (typeof VALID_STATUSES)[number];
type Verified = (typeof VALID_VERIFIED)[number];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; status?: string; verified?: string }>;
}) {
  const p        = await searchParams;
  const page     = Math.max(1, Number(p.page) || 1);
  const limitRaw = Number(p.limit);
  const limit    = (VALID_LIMITS as readonly number[]).includes(limitRaw)
    ? (limitRaw as 10 | 20 | 50) : 20;
  const search   = p.search ?? "";
  const status   = (VALID_STATUSES as readonly string[]).includes(p.status ?? "")
    ? (p.status as Status) : "all";
  const verified = (VALID_VERIFIED as readonly string[]).includes(p.verified ?? "")
    ? (p.verified as Verified) : "all";

  const [data, vehicles] = await Promise.all([
    getCabDrivers({ page, limit, search, status, verified }),
    getActiveVehiclesForDriver(),
  ]);

  return (
    <CabDriversClient
      initialData={data}
      vehicles={vehicles}
      search={search}
      status={status}
      verified={verified}
    />
  );
}
