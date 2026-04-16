import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Hotel } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { getHotelById, getDestinationsForSelect } from "../actions";
import { DetailsTab } from "./tabs/DetailsTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { ImagesTab } from "./tabs/ImagesTab";

export default async function HotelEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const hotel = await getHotelById(id);
    if (!hotel) notFound();

    const serializedCategories = hotel.image_categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        is_required: cat.is_required,
        is_system: cat.is_system,
        room_pricing_id: cat.room_pricing_id,
        room_pricing: cat.room_pricing,
        images: cat.images,
    }));

    const serializedHotel = {
        ...hotel,
        latitude: hotel.latitude ? Number(hotel.latitude) : null,
        longitude: hotel.longitude ? Number(hotel.longitude) : null,
        room_pricing: hotel.room_pricing.map(r => ({
            ...r,
            price_per_night: Number(r.price_per_night),
            original_price: r.original_price ? Number(r.original_price) : null,
            margin_percentage: Number(r.margin_percentage),
        })),
    };

    const destinations = await getDestinationsForSelect();

    const totalImages = hotel.image_categories.reduce(
        (acc, cat) => acc + cat.images.length, 0
    );

    return (
        <div className="space-y-6 w-full">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotels">Hotels</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>{hotel.name}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Hotel header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/hotels"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Hotel className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold">{hotel.name}</h1>
                        <Badge variant={hotel.is_active ? "default" : "secondary"} className="text-xs">
                            {hotel.is_active ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {hotel.destination.name} · {hotel.room_pricing.length} rooms · {totalImages} images
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="rooms">
                        Rooms
                        {hotel.room_pricing.length > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {hotel.room_pricing.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="images">
                        Images
                        {totalImages > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {totalImages}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-6">
                    <DetailsTab hotel={serializedHotel} destinations={destinations} />
                </TabsContent>

                <TabsContent value="rooms" className="mt-6">
                    <RoomsTab hotel_id={serializedHotel.id} rooms={serializedHotel.room_pricing} />
                </TabsContent>

                <TabsContent value="images" className="mt-6">
                    <ImagesTab hotel_id={hotel.id} categories={serializedCategories} />
                </TabsContent>
            </Tabs>
        </div>
    );
}