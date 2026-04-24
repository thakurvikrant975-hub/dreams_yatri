// app/(dashboard)/dashboard/packages/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Package as PkgIcon } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  getPackageById,
  getDestinationsForSelect,
  getHotelsForSelect,
  getActivitiesForSelect,
  getCategoriesForSelect,
  getTagsForSelect,
  getPoliciesForSelect,
} from "../actions";
import { BasicTab } from "./tabs/BasicTab";
import { DurationsTab } from "./tabs/DurationsTab";
import { StayCategoriesTab } from "./tabs/StayCategoriesTab";
import { PricingTab } from "./tabs/PricingTab";
import { ItineraryTab } from "./tabs/ItineraryTab";
import { PoliciesTab } from "./tabs/PoliciesTab";
import { ImagesTab } from "./tabs/ImagesTab";

export default async function PackageEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: idStr } = await params;
  const { tab = "basic" } = await searchParams;
  const id = Number(idStr);

  const [pkg, destinations, hotels, activities, categories, tags, policies] = await Promise.all([
    getPackageById(id),
    getDestinationsForSelect(),
    getHotelsForSelect(),
    getActivitiesForSelect(),
    getCategoriesForSelect(),
    getTagsForSelect(),
    getPoliciesForSelect(),
  ]);

  if (!pkg) notFound();

  const assignedPolicyIds = pkg.policies.map(p => p.policy_id);

  // Serialise Decimal fields
  const durations = pkg.durations.map(d => ({
    ...d,
    pricing: d.pricing.map(p => ({
      ...p,
      price: Number(p.price),
      original_price: p.original_price ? Number(p.original_price) : null,
    })),
  }));

  // In [id]/page.tsx — after the Promise.all, add:

  const serializedActivities = activities.map(a => ({
    ...a,
    duration_hours: a.duration_hours ? Number(a.duration_hours) : null,
  }));

  const TABS = [
    { value: "basic", label: "Basic Info" },
    { value: "durations", label: `Durations (${durations.length})` },
    { value: "stay", label: `Stay Types (${pkg.stay_categories.length})` },
    { value: "pricing", label: "Pricing" },
    { value: "itinerary", label: "Itinerary" },
    { value: "policies", label: "Policies" },
    { value: "images", label: `Images (${pkg.images.length})` },
  ];



  return (
    <div className="space-y-6 ">
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
          <PkgIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{pkg.title}</h1>
            <Badge variant={pkg.is_active ? "default" : "secondary"} className="text-xs">
              {pkg.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {pkg.destination.name} · {durations.length} duration{durations.length !== 1 ? "s" : ""}
            {pkg.stay_categories.length > 0 && ` · ${pkg.stay_categories.length} stay type${pkg.stay_categories.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <Tabs defaultValue={tab}>
        <TabsList className="flex w-full overflow-x-auto">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="shrink-0">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <BasicTab
            pkg={{
              id: pkg.id,
              title: pkg.title,
              slug: pkg.slug,
              description: pkg.description,
              meta_title: pkg.meta_title,
              meta_desc: pkg.meta_desc,
              thumbnail: pkg.thumbnail,
              cover_image: pkg.cover_image,
              inclusions: pkg.inclusions,
              exclusions: pkg.exclusions,
              is_active: pkg.is_active,
              destination: pkg.destination,
            }}
            destinations={destinations}
            categories={categories}
            tags={tags}
            assignedTagIds={pkg.tags.map(t => t.tag.id)}
            assignedCategoryIds={pkg.categories.map(c => c.category.id)}
          />
        </TabsContent>

        <TabsContent value="durations" className="mt-6">
          <DurationsTab package_id={id} durations={durations} />
        </TabsContent>

        <TabsContent value="stay" className="mt-6">
          <StayCategoriesTab package_id={id} stayCategories={pkg.stay_categories} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <PricingTab
            package_id={id}
            durations={durations}
            stayCategories={pkg.stay_categories}
          />
        </TabsContent>

        <TabsContent value="itinerary" className="mt-6">
          <ItineraryTab
            package_id={id}
            destination_id={pkg.destination.id}
            durations={durations}
            hotels={hotels}
            activities={serializedActivities}
            stayCategories={pkg.stay_categories}
          />
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <PoliciesTab
            package_id={id}
            allPolicies={policies}
            assignedPolicyIds={assignedPolicyIds}
          />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImagesTab package_id={id} images={pkg.images} />
        </TabsContent>
      </Tabs>
    </div>
  );
}