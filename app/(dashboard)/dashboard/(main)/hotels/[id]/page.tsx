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
import {
    getHotelById,
    getDestinationsForSelect,
    getMealTypes,
    getDietTypes,
    getMealPricings,
} from "../actions";
import { DetailsTab } from "./tabs/DetailsTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { PricingTab } from "./tabs/PricingTab";
import { ChildPoliciesTab } from "./tabs/ChildPoliciesTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { MealsTab } from "./tabs/MealsTab";

export default async function HotelEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;
    const id = Number(idStr);

    const [hotel, destinations, mealTypes, dietTypes, mealPricings] = await Promise.all([
        getHotelById(id),
        getDestinationsForSelect(),
        getMealTypes(),
        getDietTypes(),
        getMealPricings(id),
    ]);

    if (!hotel) notFound();

    // Serialize Decimal fields and build tab-safe data
    const serializedLocation = hotel.location ? {
        id:        String(hotel.location.id),
        name:      hotel.location.name,
        type:      hotel.location.type as import("../../components/location/location.types").LocationType,
        breadcrumb: [
            hotel.location.name,
            (hotel.location as any).state?.name,
            (hotel.location as any).country?.name,
        ].filter(Boolean).join(", "),
        slug:      hotel.location.slug,
        latitude:  hotel.location.latitude  != null ? Number(hotel.location.latitude)  : null,
        longitude: hotel.location.longitude != null ? Number(hotel.location.longitude) : null,
    } : null;

    const serializedHotel = {
        ...hotel,
        location: serializedLocation,
        childPolicies: hotel.childPolicies.map((p) => ({
            ...p,
            price: p.price ? Number(p.price) : null,
        })),
        hotelRooms: hotel.hotelRooms.map((room) => ({
            ...room,
            pricing: room.pricing.map((p) => ({
                ...p,
                price_per_night: Number(p.price_per_night),
                original_price: p.original_price ? Number(p.original_price) : null,
                extra_bed_rate: p.extra_bed_rate ? Number(p.extra_bed_rate) : null,
                margin_percentage: Number(p.margin_percentage),
                gst_percentage: Number(p.gst_percentage),
                occupancy_prices: p.occupancy_prices.map((op) => ({
                    ...op,
                    price_per_night: Number(op.price_per_night),
                    original_price: op.original_price ? Number(op.original_price) : null,
                })),
            })),
        })),  
        room_pricing: hotel.room_pricing.map((p) => ({
            ...p,
            price_per_night: Number(p.price_per_night),
            original_price: p.original_price ? Number(p.original_price) : null,
            extra_bed_rate: p.extra_bed_rate ? Number(p.extra_bed_rate) : null,
            margin_percentage: Number(p.margin_percentage),
            gst_percentage: Number(p.gst_percentage),
            occupancy_prices: p.occupancy_prices.map((op) => ({
                ...op,
                price_per_night: Number(op.price_per_night),
                original_price: op.original_price ? Number(op.original_price) : null,
            })),
            seasons: p.seasons.map((s) => ({
                ...s,
                price_per_night:         Number(s.price_per_night),
                weekend_price_per_night: s.weekend_price_per_night ? Number(s.weekend_price_per_night) : null,
                original_price:          s.original_price  ? Number(s.original_price)  : null,
                extra_bed_rate:          s.extra_bed_rate   ? Number(s.extra_bed_rate)  : null,
                occupancy_prices: s.occupancy_prices.map((op) => ({
                    ...op,
                    price_per_night: Number(op.price_per_night),
                    original_price:  op.original_price ? Number(op.original_price) : null,
                })),
            })),
        })),
    };

const serializedCategories = hotel.image_categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    is_required: cat.is_required,
    is_system: cat.is_system,
    room_pricing_id: cat.room_pricing_id,
    room_pricing: cat.room_pricing,
    images: cat.images.map((img) => ({
        ...img,
        url: img.url ?? "", 
    })),
}));

    const totalImages = hotel.image_categories.reduce(
        (acc, cat) => acc + cat.images.length,
        0
    );
    const totalRooms = hotel.hotelRooms.length;
    const totalPlans = hotel.room_pricing.length;
    const totalChildPolicies = hotel.childPolicies.length;

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

            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild className="hover:bg-dashboard-base-200 cursor-pointer">
                    <Link href="/dashboard/hotels"><ChevronLeft className="h-4 w-4 text-dashboard-base-content/70" /></Link>
                </Button>
                <div className="h-10 w-10 rounded-xl bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                    <Hotel className="h-5 w-5 text-dashboard-primary" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold text-dashboard-base-content">{hotel.name}</h1>
                        <Badge
                            className={hotel.is_active
                                ? "text-xs bg-dashboard-success/15 text-dashboard-success border-dashboard-success/30 border"
                                : "text-xs bg-dashboard-base-300 text-dashboard-base-content/50 border-dashboard-base-content/20 border"
                            }
                        >
                            {hotel.is_active ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    <p className="text-sm text-dashboard-base-content/60">
                        {hotel.destination.name}
                        {totalRooms > 0 && ` · ${totalRooms} room${totalRooms !== 1 ? "s" : ""}`}
                        {totalPlans > 0 && ` · ${totalPlans} plan${totalPlans !== 1 ? "s" : ""}`}
                        {totalImages > 0 && ` · ${totalImages} image${totalImages !== 1 ? "s" : ""}`}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="rooms">
                        Rooms
                        {totalRooms > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {totalRooms}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="meals">
                        Meals
                        {mealPricings.length > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {mealPricings.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="pricing">
                        Pricing
                        {totalPlans > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {totalPlans}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="child-policies">
                        Child Policies
                        {totalChildPolicies > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                                {totalChildPolicies}
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
                    <RoomsTab
                        hotel_id={id}
                        rooms={serializedHotel.hotelRooms}
                    />
                </TabsContent>

                <TabsContent value="pricing" className="mt-6">
                    <PricingTab
                        hotel_id={id}
                        rooms={serializedHotel.hotelRooms.map((r) => ({
                            id: r.id,
                            name: r.name,
                        }))}
                        pricing={serializedHotel.room_pricing}
                        mealTypes={mealTypes}
                        dietTypes={dietTypes}
                    />
                </TabsContent>

                <TabsContent value="child-policies" className="mt-6">
                    <ChildPoliciesTab
                        hotel_id={id}
                        initialPolicies={serializedHotel.childPolicies}
                    />
                </TabsContent>

                <TabsContent value="meals" className="mt-6">
                    <MealsTab hotel_id={id} initialMeals={mealPricings} />
                </TabsContent>

                <TabsContent value="images" className="mt-6">
                    <ImagesTab hotel_id={id} categories={serializedCategories} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
