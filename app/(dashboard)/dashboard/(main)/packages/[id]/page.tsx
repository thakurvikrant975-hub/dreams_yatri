import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Package } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  getPackageByIdAction,
  getDestinationsForSelectAction,
  getPoliciesAction,
  getPackagePoliciesAction,
} from "@/app/actions/packages/package.actions";
import { BasicTab } from "./tabs/BasicTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { GalleryTab } from "./tabs/GalleryTab";
import { RoutesTab } from "./tabs/RoutesTab";
import { ItineraryTab } from "./tabs/ItineraryTab";
import { PricingPreviewTab } from "./tabs/PricingPreviewTab";
import { PoliciesTab } from "./tabs/PoliciesTab";

export default async function PackageEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  const [result, destinations, allPolicies, activePolicyIds] = await Promise.all([
    getPackageByIdAction(id),
    getDestinationsForSelectAction(),
    getPoliciesAction(),
    getPackagePoliciesAction(id),
  ]);

  if (!result.success) notFound();
  const pkg = result.data;

  const serializedPricings = pkg.packagePricings.map(p => ({
    ...p,
    margin_percentage: Number(p.margin_percentage),
    gst_percentage: Number(p.gst_percentage),
  }));

  const serializedCabOptions = pkg.cabOptions.map(c => ({
    ...c,
    rate_per_cab: Number(c.rate_per_cab),
  }));

  return (
    <div className="space-y-6 w-full">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/dashboard/packages">Packages</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{pkg.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/packages"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{pkg.title}</h1>
            <Badge variant={pkg.is_active ? "default" : "secondary"} className="text-xs">
              {pkg.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {pkg.destination.name}
            {pkg.durations.length > 0 && ` · ${pkg.durations.length} duration${pkg.durations.length !== 1 ? "s" : ""}`}
            {pkg.packageRoutes.length > 0 && ` · ${pkg.packageRoutes.length} route${pkg.packageRoutes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="routes">Route Builder</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <BasicTab pkg={pkg} destinations={destinations} />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImagesTab packageId={id} />
        </TabsContent>

        <TabsContent value="gallery" className="mt-6">
          <GalleryTab packageId={id} />
        </TabsContent>

        <TabsContent value="routes" className="mt-6">
          <RoutesTab
            packageId={id}
            durations={pkg.durations}
            routes={pkg.packageRoutes}
            destinations={destinations}
          />
        </TabsContent>

        <TabsContent value="itinerary" className="mt-6">
          <ItineraryTab
            packageId={id}
            destinationId={pkg.destination.id}
            durations={pkg.durations}
            routes={pkg.packageRoutes}
            categories={pkg.stay_categories}
            cabOptions={serializedCabOptions}
          />
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <PricingPreviewTab
            packageId={id}
            durations={pkg.durations}
            categories={pkg.stay_categories}
            routes={pkg.packageRoutes}
            pricings={serializedPricings}
          />
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <PoliciesTab
            packageId={id}
            allPolicies={allPolicies}
            activePolicyIds={activePolicyIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
