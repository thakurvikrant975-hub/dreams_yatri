import Link from "next/link";
import { AlertTriangle, ArrowLeft, Eye } from "lucide-react";
import { getCatalogPackagePreviewSummary, getCatalogPackageIsActive } from "@/app/actions/packages/fetch-catalog-preview";
import { ItineraryDocument } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { PUBLISHED_THEME } from "@/app/(website)/custom-package/[id]/components/published-theme";

// Fallback staff preview for a catalog package with no active duration/route
// configured — see fetch-catalog-preview.ts's getCatalogPackagePreviewSummary.
// Same document component as the full preview at ../[duration]/[route]/[stay],
// just with an empty itinerary: there is nothing to show day-by-day yet, only
// what's set at the package level (title, cover, description, inclusions/
// exclusions, policies).
export default async function CatalogPackagePrereviewSummaryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [data, isActive] = await Promise.all([
    getCatalogPackagePreviewSummary(slug),
    getCatalogPackageIsActive(slug),
  ]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-semibold">Package not found</p>
        <Link href="/dashboard/package-templates" className="text-sm text-primary hover:underline">
          Back to Package Templates
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <style>{PUBLISHED_THEME}</style>

      <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white/95 backdrop-blur px-4 py-2.5 no-print">
        <Link href="/dashboard/package-templates" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <span className="h-4 w-px bg-neutral-200 shrink-0" />
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold shrink-0">
          <Eye className="h-4 w-4 text-primary-600" /> Staff Preview
        </span>
        <span className="text-sm text-neutral-500 truncate">{data.title}</span>
        <div className="flex-1" />
        {!isActive && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 text-xs font-semibold px-2.5 py-1 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" /> Offline — not published on the public site
          </span>
        )}
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-500/10 mx-4 mt-4 px-4 py-3 text-sm text-amber-800 flex items-start gap-2 no-print">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          This package has no active duration or route configured in the catalog yet, so there&apos;s no
          day-by-day itinerary to show — only what&apos;s set at the package level below.
        </span>
      </div>

      <div className="w-full">
        <ItineraryDocument form={data} published variant="page" />
      </div>
    </div>
  );
}
