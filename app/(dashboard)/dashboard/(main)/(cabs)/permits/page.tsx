import type { Metadata } from "next";
import { getPermits } from "./actions";
import { PermitsClient } from "./PermitsClient";

export const metadata: Metadata = {
  title: "Permits - Dashboard",
  robots: { index: false, follow: false },
};

const VALID_LIMITS   = [10, 20, 50] as const;
const VALID_STATUSES = ["active", "inactive", "all"] as const;

export default async function PermitsPage({
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
  const category = p.category ?? "all";
  const status   = (VALID_STATUSES as readonly string[]).includes(p.status ?? "")
    ? (p.status ?? "all")
    : "all";

  const { rows, total } = await getPermits({ page, limit, search, category, status });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Permits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage entry permits, mountain passes, wildlife fees, and other travel permits
        </p>
      </div>

      <PermitsClient
        initialRows={rows}
        initialTotal={total}
        page={page}
        limit={limit}
        search={search}
        category={category}
        status={status}
      />
    </div>
  );
}
