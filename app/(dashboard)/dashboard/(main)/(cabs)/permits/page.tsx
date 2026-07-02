import type { Metadata } from "next";
import PermitsPage from "./PermitsClient";
import { PERMIT_CATEGORIES } from "./permit.types";

export const metadata: Metadata = {
  title: "Permits - Dashboard",
  description: "",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const VALID_LIMITS    = [10, 20, 50] as const;
const VALID_STATUSES  = ["active", "inactive", "all"] as const;
const VALID_CATEGORIES = [...PERMIT_CATEGORIES, "all"] as const;

type Status   = (typeof VALID_STATUSES)[number];
type Category = (typeof VALID_CATEGORIES)[number];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; limit?: string; search?: string;
    category?: string; status?: string;
  }>;
}) {
  const p = await searchParams;

  const page     = Math.max(1, Number(p.page) || 1);
  const limitRaw = Number(p.limit);
  const limit    = (VALID_LIMITS as readonly number[]).includes(limitRaw)
    ? (limitRaw as 10 | 20 | 50)
    : 10;
  const search   = p.search ?? "";
  const category = (VALID_CATEGORIES as readonly string[]).includes(p.category ?? "")
    ? (p.category as Category)
    : "all";
  const status   = (VALID_STATUSES as readonly string[]).includes(p.status ?? "")
    ? (p.status as Status)
    : "all";

  return (
    <PermitsPage
      page={page}
      limit={limit}
      search={search}
      category={category}
      status={status}
    />
  );
}
