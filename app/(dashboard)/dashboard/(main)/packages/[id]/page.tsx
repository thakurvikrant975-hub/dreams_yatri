import { notFound } from "next/navigation";
import { Badge } from "../../components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../../components/ui/tabs";
import { PackageForm } from "../components/PackageForm";
import { ImagesTab } from "./ImagesTab";
import { RouteBuilderTab } from "./RouteBuilderTab";
import { ItineraryBuilderTab } from "./ItineraryBuilderTab";
import { PoliciesTab } from "./PoliciesTab";
import { GalleryTab } from "./GalleryTab";
import { PricingTab } from "./PricingTab";
import { PricingPreviewTab } from "./PricingPreviewTab";
import { POLICY_TYPES, type PolicyType } from "../../policies/constants";
import { getPackageForBuilder } from "../actions";
import {
  CalendarDays, GalleryHorizontal, Images, Info, Package, Route,
  ShieldCheck, BadgeDollarSign, Settings2,
} from "lucide-react";

// ── Tab shell ─────────────────────────────────────────────────────────────

const TABS = [
  { value: "basic-info",          label: "Basic Info",          icon: Info },
  { value: "images",              label: "Images",              icon: Images },
  { value: "route-builder",       label: "Route Builder",       icon: Route },
  { value: "itinerary-builder",   label: "Itinerary Builder",   icon: CalendarDays },
  { value: "policies",            label: "Policies",            icon: ShieldCheck },
  { value: "gallery",             label: "Gallery",             icon: GalleryHorizontal },
  { value: "pricing",             label: "Pricing",             icon: Settings2 },
  { value: "pricing-preview",     label: "Pricing Preview",     icon: BadgeDollarSign },
] as const;

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Coming soon</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function PackageBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) notFound();

  const pkg = await getPackageForBuilder(id);
  if (!pkg) notFound();

  const initialData = {
    title: pkg.title,
    slug: pkg.slug,
    thumbnail: pkg.thumbnail,
    description: pkg.description ?? "",
    destination_id: pkg.destination_id,
    inclusions: pkg.inclusions,
    exclusions: pkg.exclusions,
    tags: pkg.tags.map(t => t.tag.name),
    category: pkg.categories.map(c => c.category.name),
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/packages">Packages</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-60 truncate">{pkg.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate">{pkg.title}</h1>
            <Badge
              variant={pkg.is_active ? "default" : "outline"}
              className="shrink-0 text-xs"
            >
              {pkg.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{pkg.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="basic-info">
        <TabsList variant="line" className="w-full justify-start border-b rounded-none pb-0 h-auto gap-0">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 px-4 pb-3 rounded-none">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1 — Basic Info */}
        <TabsContent value="basic-info" className="pt-6">
          <div >
            <PackageForm
              mode="update"
              packageId={pkg.id}
              initialData={initialData}
              initialDestinationLabel={pkg.destination.name}
            />
          </div>
        </TabsContent>

        {/* Tab 2 — Images (ASSET POOL) */}
        <TabsContent value="images" className="pt-6">
          <ImagesTab packageId={pkg.id} initialImages={pkg.images} />
        </TabsContent>

        {/* Tab 3 — Route Builder */}
        <TabsContent value="route-builder" className="pt-6">
          <RouteBuilderTab
            packageId={pkg.id}
            initialData={pkg.durations as never}
            packageImages={pkg.images.map(img => ({ id: img.id, url: img.url, is_primary: img.is_primary }))}
          />
        </TabsContent>

        {/* Tab 4 — Itinerary Builder */}
        <TabsContent value="itinerary-builder" className="pt-6">
          <ItineraryBuilderTab
            packageId={pkg.id}
            destinationId={pkg.destination_id}
            durations={pkg.durations.map((d) => ({
              id: d.id,
              label: d.label,
              days: d.days,
              nights: d.nights,
              is_default: d.is_default,
              routes: d.routes.map((r) => ({ id: r.id, name: r.name })),
            }))}
            stayCategories={pkg.stay_categories}
          />
        </TabsContent>

        {/* Tab 5 — Policies */}
        <TabsContent value="policies" className="pt-6">
          <PoliciesTab
            packageId={pkg.id}
            initialPolicies={Object.fromEntries(
              POLICY_TYPES.map((type) => {
                const match = pkg.policies.find((p) => p.policy.type === type);
                return [type, match ? { id: match.policy.id, title: match.policy.title } : null];
              }),
            ) as Record<PolicyType, { id: number; title: string } | null>}
          />
        </TabsContent>

        {/* Tab 6 — Gallery (INTRO SECTION) */}
        <TabsContent value="gallery" className="pt-6">
          <GalleryTab
            packageId={pkg.id}
            initialGallery={(() => {
              const map = new Map(pkg.gallery.map((g) => [g.position, g]));
              return Array.from({ length: 5 }, (_, i) => {
                const g = map.get(i + 1);
                if (!g) return null;
                return {
                  id: g.id,
                  position: g.position,
                  image_url: g.image_url,
                  source_type: g.source_type as "PACKAGE" | "HOTEL" | "ACTIVITY" | "ROOM",
                  source_id: g.source_id,
                  label: g.label,
                };
              });
            })()}
          />
        </TabsContent>

        {/* Tab 7 — Pricing (margin / GST config) */}
        <TabsContent value="pricing" className="pt-6">
          <PricingTab
            packageId={pkg.id}
            durations={pkg.durations.map((d) => ({
              id: d.id,
              label: d.label,
              days: d.days,
              nights: d.nights,
            }))}
            stayCategories={pkg.stay_categories.map((c) => ({
              id: c.id,
              label: c.label,
              slug: c.slug,
            }))}
            initialPricings={pkg.packagePricings}
          />
        </TabsContent>

        {/* Tab 8 — Pricing Preview (interactive calculator) */}
        <TabsContent value="pricing-preview" className="pt-6">
          <PricingPreviewTab
            packageId={pkg.id}
            durations={pkg.durations.map((d) => ({
              id: d.id,
              label: d.label,
              days: d.days,
              nights: d.nights,
              routes: d.routes.map((r) => ({ id: r.id, name: r.name })),
            }))}
            stayCategories={pkg.stay_categories.map((c) => ({
              id: c.id,
              label: c.label,
              slug: c.slug,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
