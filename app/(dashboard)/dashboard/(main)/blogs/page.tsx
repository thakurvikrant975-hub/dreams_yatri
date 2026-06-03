import type { Metadata } from "next";
import BlogsClient from "./BlogsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog Reviews - Dashboard",
  robots: { index: false, follow: false },
};

const VALID_STATUSES = ["all", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "DRAFT"] as const;
const VALID_LIMITS   = [10, 20, 50] as const;

type BlogStatus = (typeof VALID_STATUSES)[number];

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?:   string;
    limit?:  string;
    search?: string;
    status?: string;
  }>;
}) {
  const p = await searchParams;

  const page   = Math.max(1, Number(p.page) || 1);
  const limitRaw = Number(p.limit);
  const limit  = (VALID_LIMITS as readonly number[]).includes(limitRaw)
    ? (limitRaw as 10 | 20 | 50)
    : 10;
  const search = p.search ?? "";
  const status = (VALID_STATUSES as readonly string[]).includes(p.status ?? "")
    ? (p.status as BlogStatus)
    : "all";

  return (
    <BlogsClient
      page={page}
      limit={limit}
      search={search}
      status={status}
    />
  );
}
