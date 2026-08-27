import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { Skeleton } from "../components/ui/skeleton";
import { getActivityTemplatesForReview } from "./actions";
import { ActivityTemplatesClient } from "./ActivityTemplatesClient";

export const metadata: Metadata = {
  title: "Activity Templates - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function ActivityTemplatesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card overflow-hidden">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function ActivityTemplatesData() {
  const data = await getActivityTemplatesForReview();

  if (!data) {
    return (
      <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-14 gap-2 text-center">
        <p className="text-sm font-medium">Account not found</p>
      </div>
    );
  }

  return <ActivityTemplatesClient rows={data.rows} />;
}

export default function ActivityTemplatesPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Activity Templates</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Activity Templates"
        description="Review activities saved to the library from approved packages — you can approve your own team's submissions"
        icon={Sparkles}
      />

      <Suspense fallback={<ActivityTemplatesSkeleton />}>
        <ActivityTemplatesData />
      </Suspense>
    </div>
  );
}
