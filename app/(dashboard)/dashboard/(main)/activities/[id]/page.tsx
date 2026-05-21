import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Activity, ImageIcon, Zap, Package } from "lucide-react";
import { Badge }    from "../../components/ui/badge";
import { Button }   from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { getActivityWithVariants, getCategoriesForSelect } from "../actions";
import { OverviewTab }  from "./tabs/OverviewTab";
import { ImagesTab }    from "./tabs/ImagesTab";
import { VariantsTab }  from "./tabs/VariantsTab";
import { AddonsTab }    from "./tabs/AddonsTab";

export const metadata: Metadata = {
    title: "Edit Activity - Dashboard",
    robots: {
        index:     false,
        follow:    false,
        nocache:   true,
        googleBot: { index: false, follow: false },
    },
};

export default async function ActivityDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;
    const id = Number(idStr);

    const [activity, categories] = await Promise.all([
        getActivityWithVariants(id),
        getCategoriesForSelect(),
    ]);

    if (!activity) notFound();

    const totalImages   = activity.images.length;
    const totalVariants = activity.variants.length;
    const totalAddons   = activity.addons.length;

    return (
        <div className="space-y-6 w-full">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    Dashboard
                </Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/dashboard/activities" className="hover:text-foreground transition-colors">
                    Activities
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium truncate max-w-48">{activity.name}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/activities">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-semibold truncate">{activity.name}</h1>
                        <Badge variant={activity.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                            {activity.is_active ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                        {activity.category?.name && `${activity.category.name}`}
                        {activity.difficulty && ` · ${activity.difficulty}`}
                        {totalVariants > 0 && ` · ${totalVariants} variant${totalVariants !== 1 ? "s" : ""}`}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="images" className="gap-1.5">
                        Images
                        {totalImages > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{totalImages}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="variants" className="gap-1.5">
                        Variants & Pricing
                        {totalVariants > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{totalVariants}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="addons" className="gap-1.5">
                        Add-ons
                        {totalAddons > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{totalAddons}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                    <OverviewTab
                        activity={{
                            id:             activity.id,
                            name:           activity.name,
                            slug:           activity.slug,
                            description:    activity.description,
                            category_id:    activity.category_id,
                            category:       activity.category,
                            difficulty:     activity.difficulty,
                            duration_hours: activity.duration_hours,
                            location_id:    activity.location_id,
                            address:        activity.address,
                            city:           activity.city,
                            state:          activity.state,
                            country:        activity.country,
                            pincode:        activity.pincode,
                            phone:          activity.phone,
                            email:          activity.email,
                            is_active:      activity.is_active,
                        }}
                        categories={categories}
                    />
                </TabsContent>

                <TabsContent value="images" className="mt-6">
                    <ImagesTab
                        activityId={activity.id}
                        activityName={activity.name}
                        initialImages={activity.images}
                    />
                </TabsContent>

                <TabsContent value="variants" className="mt-6">
                    <VariantsTab
                        activity_id={activity.id}
                        initialVariants={activity.variants}
                    />
                </TabsContent>

                <TabsContent value="addons" className="mt-6">
                    <AddonsTab
                        activity_id={activity.id}
                        initialAddons={activity.addons}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
