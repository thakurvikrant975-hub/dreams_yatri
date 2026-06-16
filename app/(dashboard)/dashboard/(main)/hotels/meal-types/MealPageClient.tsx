import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Utensils } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getMealTypes, createMealType, updateMealType, deleteMealType } from "../actions";
import { MealTypeManagerClient } from "./MealTypeManagerClient";

// Async sub-component — isolated so Suspense can stream just this part
async function MealTypeData() {
    const mealTypes = await getMealTypes();
    return (
        <MealTypeManagerClient
            items={mealTypes}
            onCreate={createMealType}
            onUpdate={updateMealType}
            onDelete={deleteMealType}
        />
    );
}

export function MealTypesLoadingSkeleton() {
    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-6 w-8 rounded-full" />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30">
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <div className="flex gap-1">
                                <Skeleton className="h-5 w-20 rounded" />
                                <Skeleton className="h-5 w-16 rounded" />
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Skeleton className="h-7 w-7 rounded-md" />
                            <Skeleton className="h-7 w-7 rounded-md" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export default function MealTypesPage() {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotels">Hotels</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Meal Types</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/hotels"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Utensils className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold">Meal Types</h1>
                    <p className="text-sm text-muted-foreground">
                        Used in hotel room pricing plans (e.g. Breakfast, Half Board)
                    </p>
                </div>
            </div>

            <Suspense fallback={<MealTypesLoadingSkeleton />}>
                <MealTypeData />
            </Suspense>
        </div>
    );
}
