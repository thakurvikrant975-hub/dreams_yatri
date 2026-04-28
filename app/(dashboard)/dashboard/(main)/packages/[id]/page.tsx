import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { getPackageForEdit, getStayCategories, getAllPolicies } from "../actions";
import { BasicTab } from "./tabs/BasicTab";
import { RoutesTab } from "./tabs/RoutesTab";
import { ItineraryTab } from "./tabs/ItineraryTab";
import { HotelsTab } from "./tabs/HotelsTab";
import { PricingTab } from "./tabs/PricingTab";
import { CabsTab } from "./tabs/CabsTab";
import { PoliciesTab } from "./tabs/PoliciesTab";
import { GalleryTab } from "./tabs/GalleryTab";
import { AdvancedTab } from "./tabs/AdvancedTab";

type Props = { params: Promise<{ id: string }> };

export default async function PackageEditPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) notFound();

  const [data, stayCategories, allPolicies] = await Promise.all([
    getPackageForEdit(id),
    getStayCategories(),
    getAllPolicies(),
  ]);

  if (!data) notFound();

  // Flatten all routes from all durations for the itinerary tab
  const allRoutes = data.durations.flatMap((d) =>
    d.routes.map((r) => ({ id: r.id, duration_id: r.duration_id, name: r.name }))
  );

  // Collect used stay category ids from hotels and pricing
  const usedCategoryIds = new Set<number>([
    ...data.packageHotels.map((h) => h.stay_category_id),
    ...data.pricing.map((p) => p.stay_category_id),
  ]);
  const usedStayCategories = stayCategories.filter((c) => usedCategoryIds.has(c.id));

  const selectedPolicyIds = data.policyMaps.map((pm) => pm.policy_id);

  return (
    <div className="p-6 space-y-5  mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/packages" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{data.title}</h1>
            <Badge variant={data.is_active ? "default" : "secondary"} className="shrink-0">
              {data.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{data.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="basic">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="hotels">Hotels</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="cabs">Cabs</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <div className="mt-5 border rounded-xl p-6">
          <TabsContent value="basic" className="mt-0">
            <BasicTab pkg={data} />
          </TabsContent>

          <TabsContent value="routes" className="mt-0">
            <RoutesTab packageId={data.id} durations={data.durations} />
          </TabsContent>

          <TabsContent value="itinerary" className="mt-0">
            <ItineraryTab
              packageId={data.id}
              durations={data.durations.map((d) => ({ id: d.id, label: d.label }))}
              allRoutes={allRoutes}
              stayCategories={stayCategories}
            />
          </TabsContent>

          <TabsContent value="hotels" className="mt-0">
            <HotelsTab
              packageId={data.id}
              initialHotels={data.packageHotels}
              stayCategories={stayCategories}
            />
          </TabsContent>

          <TabsContent value="pricing" className="mt-0">
            <PricingTab
              packageId={data.id}
              durations={data.durations.map((d) => ({ id: d.id, label: d.label }))}
              stayCategories={stayCategories}
              initialPricing={data.pricing}
            />
          </TabsContent>

          <TabsContent value="cabs" className="mt-0">
            <CabsTab packageId={data.id} initialCabs={data.cabs} />
          </TabsContent>

          <TabsContent value="policies" className="mt-0">
            <PoliciesTab
              packageId={data.id}
              allPolicies={allPolicies}
              selectedIds={selectedPolicyIds}
            />
          </TabsContent>

          <TabsContent value="gallery" className="mt-0">
            <GalleryTab packageId={data.id} initial={data.gallery} />
          </TabsContent>

          <TabsContent value="advanced" className="mt-0">
            <AdvancedTab
              packageId={data.id}
              slug={data.slug}
              isActive={data.is_active}
              usedStayCategories={usedStayCategories}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
