import type { Metadata } from "next";
import { Suspense } from "react";
import { Target } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { Skeleton } from "../components/ui/skeleton";
import { istYearMonth } from "@/app/lib/ist-window";
import { getSalesTargetsPageData } from "./actions";
import { SalesTargetsClient } from "./SalesTargetsClient";

export const metadata: Metadata = {
  title: "Sales Targets - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function TargetsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

async function SalesTargetsData({ year, month }: { year: number; month: number }) {
  const data = await getSalesTargetsPageData(year, month);
  return <SalesTargetsClient data={data} />;
}

export default async function SalesTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const current = istYearMonth();
  const year = sp.year ? Number(sp.year) : current.year;
  const month = sp.month ? Number(sp.month) : current.month;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Sales Targets</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Sales Targets"
        description="Set monthly revenue and booking targets for sales teams and individual executives"
        icon={Target}
      />

      <Suspense fallback={<TargetsSkeleton />} key={`${year}-${month}`}>
        <SalesTargetsData year={year} month={month} />
      </Suspense>
    </div>
  );
}
