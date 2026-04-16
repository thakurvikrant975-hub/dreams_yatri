import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getDestinationsForSelect } from "../actions";
import { HotelCreateForm } from "./HotelCreateForm";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";


export default async function NewHotelPage() {
    const destinations = await getDestinationsForSelect();

    return (
        <div className="space-y-6 w-full ">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotels">Hotels</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>New Hotel</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/hotels"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>


                <div>
                    <h1 className="text-xl font-semibold">Add Hotel</h1>
                    <p className="text-sm text-muted-foreground">Fill in hotel details, rooms and upload photos</p>
                </div>
            </div>

            <HotelCreateForm destinations={destinations} />
        </div>
    );
}