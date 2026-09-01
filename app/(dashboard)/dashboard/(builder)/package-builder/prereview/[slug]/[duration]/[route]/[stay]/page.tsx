import Link from "next/link";
import { AlertTriangle, ArrowLeft, Eye } from "lucide-react";
import { getCatalogPackagePreview, getCatalogPackageIsActive } from "@/app/actions/packages/fetch-catalog-preview";
import { ItineraryDocument } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { PUBLISHED_THEME } from "@/app/(website)/custom-package/[id]/components/published-theme";

// Staff preview of a catalog package, rendered through the builder's own
// document component — the exact page a reviewer sees at
// /package-builder/[id]/review and a client sees at /custom-package/[id].
// See fetch-catalog-preview.ts for why this is a fresh read of the catalog
// tables rather than a fake custom_packages row: PreviewData is already a
// flat render contract with every live-pricing FK optional, so there is
// nothing to bridge — only to fill in from the catalog's own content.
//
// No booking bar (unlike the client's /custom-package/[id] page) — there is
// no real custom_packages id behind this to book against, and the whole
// point of a preview is that nothing here writes to the database.
export default async function CatalogPackagePrereviewPage({
  params,
}: {
  params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
}) {
  const { slug, duration, route, stay } = await params;

  const [data, isActive] = await Promise.all([
    getCatalogPackagePreview(slug, duration, route, stay),
    getCatalogPackageIsActive(slug),
  ]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-semibold">Package not found</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          No package matches this slug/duration/route/stay combination — it may have been deleted, or the stay
          category no longer exists.
        </p>
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

      <div className="w-full">
        <ItineraryDocument form={data} published variant="page" />
      </div>
    </div>
  );
}
