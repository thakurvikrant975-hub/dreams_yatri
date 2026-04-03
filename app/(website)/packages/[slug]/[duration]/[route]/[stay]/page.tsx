// things to do - 
// 1. .room_pricing?.[0] to actual option in original and discounted price calculation

import { notFound } from "next/navigation";
import { packagesRepository } from "@/app/repositories/packages.repository";
import PackageHero from "./components/hero";
import PackageTab from "./components/PackageTab";
import TripDuration from "./components/inputs/TripDuration";
import StayCategory from "./components/inputs/StayCategory";
import PricingCard from "./components/SidebarCards/PricingCard";
import CoupenCard from "./components/SidebarCards/CoupenCard";
import EnquiryForm from "./components/SidebarCards/EnquiryForm";
import ItinerarySection, {ItineraryDay,  DaySection } from "./components/Itnary";
import { RouteOption } from "@/app/types/package-page.types";
import DestinationRoutes from "./components/inputs/DestinationRoutes";


export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
}) {
    const { slug, duration, route, stay } = await params;

    const result = await packagesRepository.findPageData(slug, duration, route, stay);
    if (!result.success) return {};

    const data = result.data;
    return {
        title: data.currentDuration.meta_title ?? `${data.title} | Dreams Yatri`,
        description: data.currentDuration.meta_desc ?? data.description,
    };
}

export default async function PackagePage({
    params,
}: {
    params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
}) {
    const { slug, duration, route, stay } = await params;

    const result = await packagesRepository.findPageData(slug, duration, route, stay);

    if (!result.success) {
        if (result.error.code === "NOT_FOUND") notFound();
        throw new Error(result.error.message);
    }

    const data = result.data;

    console.log(data);

    // package hero

    // routes hero
    const routes = data.currentDuration.routes as RouteOption[];
    const defaultRoute = routes.find(r => r.is_default) ?? routes[0];
    const routeStops = defaultRoute.stops.map((stop, i) => ({
        days: stop?.d,
        place: stop?.p,
    }));

    // gallery images
    const image_gallery = [
        data.cover_image,

        // hotel images
        ...[
            ...new Set(
                data.currentDuration.filteredItinerary.flatMap(i =>
                    i.hotel?.images?.map(img => img.url) || []
                )
            )
        ].slice(0, 2),

        // activity images (FIXED)
        ...[
            ...new Set(
                data.currentDuration.filteredItinerary.flatMap(i =>
                    i.activity_details?.flatMap(activity =>
                        activity.images?.map(img => img.url) || []
                    ) || []
                )
            )
        ].slice(0, 2),



    ].filter((img): img is string => Boolean(img));

    const package_images = data.images?.map(img => img.url);

    // trip duration
    const durationOptions = data.durations.map((d, i) => ({
        slug: d.slug.toString(),
        label: `${d.days} Days`,
        price: `₹${d?.startingPrice?.toLocaleString()}`,
        image_url: package_images?.[(package_images.length - 1) - i],
        isDefault: d.is_default,
    }))


    // trip routes
    const routesOption = data.currentDuration.routes.map(r => ({
        slug: r.slug,
        stops: r.stops.map(s => s.p)
    }))

    // stay category
    const stayOptions = data.stay_categories.map(s => ({
        slug: s.slug,
        label: s.label,
    }))

    //pricing

    // original price 
    // need to handle  .room_pricing?.[0] to actual option  ------
    const hotelOriginalPrice = data.currentDuration.filteredItinerary.reduce((acc, curr) => {
        const room = curr.hotel?.room_pricing?.[0];
        if (!room) return acc;

        const original = Number(room.original_price);
        const margin = Number(room.margin_percentage);
        const price = original * (1 + margin / 100);

        return acc + price;
    }, 0);

    const activityOriginalPrice = data.currentDuration.filteredItinerary.reduce((acc, curr) => {
        const activities = curr.activity_details?.[0];
        if (!activities) return acc;

        const original = Number(activities.original_price);
        const margin = Number(activities.margin_percentage);
        const price = original * (1 + margin / 100);
        return acc + price;

    }, 0)


    const originalPrice = Math.ceil(hotelOriginalPrice + activityOriginalPrice);

    // actual price
    // need to handle  .room_pricing?.[0] to actual option -----
    const hotelPrice = data.currentDuration.filteredItinerary.reduce((acc, curr) => {
        const room = curr.hotel?.room_pricing?.[0];
        if (!room) return acc;

        const price = Number(room.price_per_night);
        const margin = Number(room.margin_percentage);
        const finalPrice = price * (1 + margin / 100);
        return acc + finalPrice;
    }, 0);

    const activityPrice = data.currentDuration.filteredItinerary.reduce((acc, curr) => {
        const activities = curr.activity_details?.[0];
        if (!activities) return acc;

        const actual = Number(activities.price);
        const margin = Number(activities.margin_percentage);
        const price = actual * (1 + margin / 100);
        return acc + price;

    }, 0)

    const discountedPrice = Math.ceil(hotelPrice + activityPrice);


    // ItinerarySection

    const itinerary: ItineraryDay[] = data.currentDuration.filteredItinerary.map(i => ({
        day: i.day,
        title: i.title,
        description: i.description,
        sections: [
            // hotels, activities, tranfers etc ....
            ...(i.hotel ? [{
                type: "stay",
                nights: Number(i.hotel_days) - 1,
                hotelName: i.hotel.name,
                stars: i.hotel.star_rating ?? 0,
                checkIn: i.hotel.check_in_time ?? "",
                checkOut: i.hotel.check_out_time ?? "",
                inclusions: [
                    {
                        label: "Breakfast",
                        status: i.meals?.includes("Breakfast") ? "included" : "excluded",
                    },
                    {
                        label: "Lunch",
                        status: i.meals?.includes("Lunch") ? "included" : "excluded",
                    },
                    {
                        label: "Dinner",
                        status: i.meals?.includes("Dinner") ? "included" : "excluded",
                    },
                ],
                images: i.hotel.images?.map(img =>  img.url) || [],
            }] : []),

            ...(i.activity_details ?
                i.activity_details.map(activity => ({
                    type: "activity",
                    name: activity.name,
                    images: activity.images?.map(img => ({    // string[] → {src, label}[]
                        src: img.url,
                        label: img.alt ?? activity.name,
                    })) ?? [],
                }))
                : [])
        ] as DaySection[]
    }))

    console.log(itinerary);



    return (
        <div>
            <PackageHero
                title={data?.title}
                duration={`${data.currentDuration.days}D/${data.currentDuration.nights}N`}
                itinerary={routeStops}
                inclusions={[
                    { key: "transfer", label: "Transfer" },
                    { key: "stay", label: "Stay" },
                    { key: "breakfast", label: "Breakfast" },
                    { key: "sightseeing", label: "Sightseeing" },
                ]}
                region={{ label: data.destination.region.name, slug: data.destination.region.slug }}

                images={[
                    ...new Set([
                        ...image_gallery,
                        ...package_images
                    ])
                ].slice(0, 5)}
            />

            <div className="flex gap-10 py-section-sm">

                <div className="flex-1">
                    <PackageTab slug={slug} duration={duration} route={route} stay={stay} />

                    <div className="py-6 flex flex-col gap-8">
                        <TripDuration durationOptions={durationOptions} baseURL={`/packages/${slug}`} durationSlug={duration} routeSlug={route} staySlug={stay} />

                        <DestinationRoutes routeSlug={route} routesOption={routesOption} baseUrl={`/packages/${slug}`} durationSlug={duration} staySlug={stay} />

                        <StayCategory stayOptions={stayOptions} baseURL={`/packages/${slug}`} durationSlug={duration} routeSlug={route} staySlug={stay} />

                        <ItinerarySection
                            days={itinerary}
                        />
                    </div>
                </div>

                <aside className="sticky top-(--header-height) w-[27%]">
                    <div className="flex flex-col gap-3">
                        <PricingCard
                            originalPrice={originalPrice}
                            discountedPrice={discountedPrice}
                            savings={originalPrice - discountedPrice}
                            packageName="Kashmir Great Lakes Trek"
                        />
                        <CoupenCard
                            coupons={[
                                { code: "MH45DREAM", discount: 2000, description: "Coupon applied successfully", applied: true },
                                { code: "TH43MK982", discount: 2000, description: "Get Discount Before it disappears", applied: false },
                            ]}
                        />
                        <EnquiryForm
                            discountedPrice={19999}
                            savings={5001}
                            packageName="Kashmir Great Lakes Trek"
                        />
                    </div>
                </aside>

            </div>
        </div>
    );
}