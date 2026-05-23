import { notFound } from "next/navigation";
import Link from "next/link";
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
  CalendarDays, ExternalLink, GalleryHorizontal, Images, Info, Package, Route,
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

const VALID_TABS = ["basic-info","images","route-builder","itinerary-builder","policies","gallery","pricing","pricing-preview"] as const;
type TabValue = typeof VALID_TABS[number];

export default async function PackageBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id: idParam }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const defaultTab: TabValue = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabValue)
    : "basic-info";
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

  const defaultDuration = pkg.durations.find(d => d.is_default);
  const defaultStay = pkg.stay_categories.find(s => s.is_default);
  const defaultRoute = defaultDuration?.routes[0];
  const websiteUrl =
    pkg.is_active && defaultDuration && defaultRoute && defaultStay
      ? `/packages/${pkg.slug}/${defaultDuration.slug}/${defaultRoute.slug}/${defaultStay.slug}`
      : null;

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
            {websiteUrl && (
              <Link
                href={websiteUrl}
                target="_blank"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View on website
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{pkg.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start bg-dashboard-base-100 border-b h-auto gap-2 border border-dashboard-base-content/20 shadow-lg">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 px-4 pb-3">
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
            destinationCoords={
              pkg.destination.latitude != null && pkg.destination.longitude != null
                ? { lat: Number(pkg.destination.latitude), lng: Number(pkg.destination.longitude) }
                : undefined
            }
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
              routes: d.routes.map((r) => ({
                id: r.id,
                name: r.name,
                stops: r.stops.map((s) => ({
                  place_name: s.place_name,
                  stay_days: s.stay_days,
                  location: s.location
                    ? { latitude: Number(s.location.latitude), longitude: Number(s.location.longitude) }
                    : null,
                })),
              })),
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
            routes={pkg.durations.flatMap((d) =>
              d.routes.map((r) => ({
                id: r.id,
                name: r.name,
                durationLabel: d.label,
              }))
            )}
          />
        </TabsContent>

        {/* Tab 7 — Pricing (margin / GST config + cab options) */}
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
            routes={pkg.durations.flatMap((d) =>
              d.routes.map((r) => ({
                id: r.id,
                name: r.name,
                durationLabel: d.label,
              }))
            )}
            cabTypes={pkg.cabTypes}
            availableVehicles={pkg.availableVehicles}
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
            cabTypes={pkg.cabTypes
              .filter((ct) => ct.is_active)
              .map((ct) => ({
                id: ct.id,
                duration_id: ct.duration_id,
                label: ct.label ?? ct.vehicle.name,
                is_default: ct.is_default,
                vehicle: {
                  id: ct.vehicle.id,
                  name: ct.vehicle.name,
                  capacity: ct.vehicle.passenger_capacity,
                },
                segments: ct.segments.map((s) => ({
                  day_from: s.day_from,
                  day_to: s.day_to,
                  pricing_type: s.cab_pricing.pricing_type,
                  price: s.cab_pricing.price,
                  destination_name: s.cab_pricing.destination.name,
                  seasons: s.cab_pricing.seasons,
                })),
              }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
