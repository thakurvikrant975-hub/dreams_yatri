import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Zap } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { getActivityWithVariants } from "../actions";
import { VariantsTab } from "./tabs/VariantsTab";
import { AddonsTab } from "./tabs/AddonsTab";

export default async function ActivityEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;
    const id = Number(idStr);

    const activity = await getActivityWithVariants(id);
    if (!activity) notFound();

    const totalVariants = activity.variants.length;
    const totalAddons = activity.addons.length;

    return (
        <div className="space-y-6 w-full">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/activities">Activities</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>{activity.name}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/activities"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold">{activity.name}</h1>
                        <Badge variant={activity.is_active ? "default" : "secondary"} className="text-xs">
                            {activity.is_active ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {activity.destination.name}
                        {activity.category && ` · ${activity.category}`}
                        {totalVariants > 0 && ` · ${totalVariants} variant${totalVariants !== 1 ? "s" : ""}`}
                        {totalAddons > 0 && ` · ${totalAddons} add-on${totalAddons !== 1 ? "s" : ""}`}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="variants">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="variants">
                        Variants & Pricing
                        {totalVariants > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {totalVariants}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="addons">
                        Add-ons
                        {totalAddons > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {totalAddons}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="variants" className="mt-6">
                    <VariantsTab
                        activity_id={id}
                        initialVariants={activity.variants}
                    />
                </TabsContent>

                <TabsContent value="addons" className="mt-6">
                    <AddonsTab
                        activity_id={id}
                        initialAddons={activity.addons}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
