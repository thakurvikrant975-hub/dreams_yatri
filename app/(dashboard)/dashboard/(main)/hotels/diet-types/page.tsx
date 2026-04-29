import Link from "next/link";
import { ChevronLeft, Leaf } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getDietTypes, createDietType, updateDietType, deleteDietType } from "../actions";
import { TypeManagerClient } from "../TypeManagerClient";

export default async function DietTypesPage() {
    const dietTypes = await getDietTypes();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotels">Hotels</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Diet Types</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/hotels"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Leaf className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold">Diet Types</h1>
                    <p className="text-sm text-muted-foreground">
                        Used in hotel room pricing plans (e.g. Veg, Non-Veg, Jain)
                    </p>
                </div>
            </div>

            <div >
                <TypeManagerClient
                    items={dietTypes}
                    label="Diet Types"
                    description="Select a diet type when creating a pricing plan"
                    onCreate={createDietType}
                    onUpdate={updateDietType}
                    onDelete={deleteDietType}
                />
            </div>
        </div>
    );
}
