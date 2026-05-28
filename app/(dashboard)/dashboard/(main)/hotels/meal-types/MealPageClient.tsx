import Link from "next/link";
import { ChevronLeft, Utensils } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getMealTypes, createMealType, updateMealType, deleteMealType } from "../actions";
import { MealTypeManagerClient } from "./MealTypeManagerClient";

export default async function MealTypesPage() {
    const mealTypes = await getMealTypes();

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

            <div>
                <MealTypeManagerClient
                    items={mealTypes}
                    onCreate={createMealType}
                    onUpdate={updateMealType}
                    onDelete={deleteMealType}
                />
            </div>
        </div>
    );
}
