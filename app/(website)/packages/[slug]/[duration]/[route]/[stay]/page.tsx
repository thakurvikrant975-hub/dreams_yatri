// things to do -
// 1. .room_pricing?.[0] to actual option in original and discounted price calculation

import { notFound } from "next/navigation";
import { fetchPackagePageData, getActivePackageParams } from "@/app/actions/packages/fetch-page-data";
import PackageHero from "./components/hero";
import PackageTab from "./components/PackageTab";
import TripDuration from "./components/inputs/TripDuration";
import StayCategory from "./components/inputs/StayCategory";
import PricingCard from "./components/SidebarCards/PricingCard";
import CoupenCard from "./components/SidebarCards/CoupenCard";
import EnquiryForm from "./components/SidebarCards/EnquiryForm";
import ItinerarySection, { ItineraryDay, DaySection } from "./components/Itnary";
import DestinationRoutes from "./components/inputs/DestinationRoutes";

export const revalidate = 3600;

export async function generateStaticParams() {
    return getActivePackageParams();
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
}) {
    const { slug, duration, route, stay } = await params;
    const data = await fetchPackagePageData(slug, duration, route, stay);
    if (!data) return {};
    return {
        title: data.selectedRoute?.meta_title ?? `${data.title} | Dreams Yatri`,
        description: data.selectedRoute?.meta_desc ?? data.description,
    };
}

export default async function PackagePage({
    params,
}: {
    params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
}) {
    const { slug: _slug, duration: _duration, route: _route, stay: _stay } = await params;

    const pageData = await fetchPackagePageData(_slug, _duration, _route, _stay);
    if (!pageData) notFound();

    console.log("[PackagePage] data:", pageData);

    // UI still uses mock data — integration pending
    const slug = "kashmir-great-lakes-trek";
    const duration = "7d-6n";
    const route = "srinagar-sonamarg";
    const stay = "standard"

    const data = {
        title: "Kashmir Great Lakes Trek",
        description: "An iconic high-altitude trek through the stunning Kashmir Valley passing pristine alpine lakes.",
        cover_image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200",
        images: [
            { url: "https://images.unsplash.com/photo-1707344088547-3cf7cea5ca49?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
            { url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1121&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
            { url: "https://images.unsplash.com/photo-1707343848552-893e05dba6ac?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
            { url: "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
        ],
        destination: {
            name: "Kashmir",
            slug: "kashmir",
            region: {
                name: "North India",
                slug: "north-india",
            },
        },
        stay_categories: [
            { slug: "standard", label: "Standard" },
            { slug: "deluxe", label: "Deluxe" },
            { slug: "luxury", label: "Luxury" },
        ],
        durations: [
            { slug: "5d-4n", days: 5, nights: 4, startingPrice: 14999, is_default: false },
            { slug: "7d-6n", days: 7, nights: 6, startingPrice: 19999, is_default: true },
            { slug: "9d-8n", days: 9, nights: 8, startingPrice: 26999, is_default: false },
        ],
        currentDuration: {
            days: 7,
            nights: 6,
            slug: "7d-6n",
            meta_title: "Kashmir Great Lakes Trek – 7 Days | Dreams Yatri",
            meta_desc: "7-day Kashmir Great Lakes Trek covering Naranag, Gangabal, and Sonamarg.",
            routes: [
                {
                    slug: "srinagar-sonamarg",
                    is_default: true,
                    stops: [
                        { d: 1, p: "Srinagar" },
                        { d: 2, p: "Naranag" },
                        { d: 3, p: "Gangabal" },
                        { d: 4, p: "Nundkol" },
                        { d: 5, p: "Sonamarg" },
                        { d: 6, p: "Srinagar" },
                        { d: 7, p: "Departure" },
                    ],
                },
                {
                    slug: "srinagar-pahalgam",
                    is_default: false,
                    stops: [
                        { d: 1, p: "Srinagar" },
                        { d: 2, p: "Pahalgam" },
                        { d: 3, p: "Aru Valley" },
                        { d: 4, p: "Baisaran" },
                        { d: 5, p: "Chandanwari" },
                        { d: 6, p: "Pahalgam" },
                        { d: 7, p: "Departure" },
                    ],
                },
            ],
            filteredItinerary: [
                {
                    day: 1,
                    title: "Arrive in Srinagar",
                    description: "Touch down in Srinagar, transfer to your houseboat on Dal Lake. Evening shikara ride.",
                    hotel_days: "2",
                    meals: ["Dinner"],
                    hotel: {
                        name: "Houseboat Heritage Inn",
                        star_rating: 4,
                        check_in_time: "14:00",
                        check_out_time: "11:00",
                        images: [
                            { url: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Houseboat" },
                            { url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Dal Lake" },
                            { url: "https://plus.unsplash.com/premium_photo-1675745329378-5573c360f69f?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3DD", alt: "Dal Lake" },
                            { url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Dal Lake" },
                            { url: "https://images.unsplash.com/photo-1621293954908-907159247fc8?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Dal Lake" },
                        ],
                        room_pricing: [
                            { original_price: "4000", price_per_night: "3200", margin_percentage: "15" },
                            { original_price: "5500", price_per_night: "4400", margin_percentage: "15" },
                        ],
                    },
                    activity_details: [
                        {
                            name: "Shikara Ride on Dal Lake",
                            original_price: "1200",
                            price: "900",
                            margin_percentage: "10",
                            images: [
                                { url: "https://images.unsplash.com/photo-1564329494258-3f72215ba175?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8c2hpa2FyYSUyMHJpZGV8ZW58MHx8MHx8fDA%3D", alt: "Shikara" },
                                { url: "https://media.istockphoto.com/id/1861559093/photo/colorful-shikara-boats.webp?a=1&b=1&s=612x612&w=0&k=20&c=XBx5n_PD3d70pOgBelsE9PqI3FntXC4dvGl5Ch-eENI=", alt: "Beutifull Lake" },
                                { url: "https://media.istockphoto.com/id/1390314915/photo/sikaras-boat-at-dal-lake-kashmir.webp?a=1&b=1&s=612x612&w=0&k=20&c=GyWIxmkjpfj5JVa2-LygALJIkmn7OdblGJp4im2Pr7Q=", alt: "Boats" },
                            ],
                        },
                      
                    ],
                },
                {
                    day: 2,
                    title: "Srinagar → Naranag Trek Begins",
                    description: "Drive to Naranag (2,400 m) and begin the ascent through pine forests.",
                    hotel_days: "2",
                    meals: ["Breakfast", "Dinner"],
                    hotel: {
                        name: "Naranag Camp",
                        star_rating: 3,
                        check_in_time: "16:00",
                        check_out_time: "08:00",
                        images: [
                            { url: "https://images.unsplash.com/photo-1571677465484-2dd540924245?q=80&w=1062&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Camp" },
                            { url: "https://images.unsplash.com/photo-1718781941548-01d220bf62fd?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Camp" },
                            { url: "https://images.unsplash.com/photo-1650643683959-b45e595db8ec?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Camp" },
                            { url: "https://images.unsplash.com/photo-1647014070673-43bad4171631?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Camp" },
                              { url: "https://images.unsplash.com/photo-1557540827-5dda50d8b8b7?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Camp" },
                        ],
                        room_pricing: [
                            { original_price: "3000", price_per_night: "2400", margin_percentage: "12" },
                        ],
                    },
                    activity_details: [
                        {
                            name: "Pine Forest Nature Walk",
                            original_price: "800",
                            price: "600",
                            margin_percentage: "10",
                            images: [
                                { url: "https://plus.unsplash.com/premium_photo-1664362416374-4f734db57037?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Pine Forest" },
                            ],
                        },
                    ],
                },
                {
                    day: 3,
                    title: "Naranag → Gangabal Lake",
                    description: "The crown jewel of the trek. Arrive at the twin Gangabal lakes (3,600 m).",
                    hotel_days: "2",
                    meals: ["Breakfast", "Lunch", "Dinner"],
                    hotel: {
                        name: "Gangabal Lakeside Camp",
                        star_rating: 3,
                        check_in_time: "15:00",
                        check_out_time: "08:00",
                        images: [
                            { url: "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Gangabal Lake" },
                        ],
                        room_pricing: [
                            { original_price: "3200", price_per_night: "2500", margin_percentage: "12" },
                        ],
                    },
                    activity_details: [],
                },
                {
                    day: 4,
                    title: "Gangabal → Nundkol Lake",
                    description: "Short trek to the adjacent Nundkol Lake with views of Harmukh peak.",
                    hotel_days: "2",
                    meals: ["Breakfast", "Dinner"],
                    hotel: {
                        name: "Nundkol Camp",
                        star_rating: 3,
                        check_in_time: "14:00",
                        check_out_time: "08:00",
                        images: [
                            { url: "https://images.unsplash.com/photo-1499678329028-101435549a4e?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Nundkol" },
                        ],
                        room_pricing: [
                            { original_price: "3200", price_per_night: "2500", margin_percentage: "12" },
                        ],
                    },
                    activity_details: [
                        {
                            name: "Harmukh Peak Viewpoint Hike",
                            original_price: "1000",
                            price: "750",
                            margin_percentage: "10",
                            images: [
                                { url: "https://images.unsplash.com/photo-1433838552652-f9a46b332c40?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Mountain View" },
                            ],
                        },
                    ],
                },
                {
                    day: 5,
                    title: "Nundkol → Sonamarg",
                    description: "Descend through meadows to reach the 'Meadow of Gold' — Sonamarg.",
                    hotel_days: "2",
                    meals: ["Breakfast", "Dinner"],
                    hotel: {
                        name: "Sonamarg Alpine Resort",
                        star_rating: 4,
                        check_in_time: "15:00",
                        check_out_time: "11:00",
                        images: [
                            { url: "https://plus.unsplash.com/premium_photo-1683121054777-acb80e8c5dc4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Sonamarg" },
                        ],
                        room_pricing: [
                            { original_price: "4500", price_per_night: "3600", margin_percentage: "15" },
                        ],
                    },
                    activity_details: [],
                },
                {
                    day: 6,
                    title: "Sonamarg → Srinagar",
                    description: "Drive back to Srinagar. Evening free for shopping at Lal Chowk.",
                    hotel_days: "2",
                    meals: ["Breakfast"],
                    hotel: {
                        name: "Srinagar Grand Hotel",
                        star_rating: 4,
                        check_in_time: "14:00",
                        check_out_time: "11:00",
                        images: [
                            { url: "https://plus.unsplash.com/premium_photo-1700483717331-6da3888bc3db?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Hotel" },
                        ],
                        room_pricing: [
                            { original_price: "5000", price_per_night: "4000", margin_percentage: "15" },
                        ],
                    },
                    activity_details: [
                        {
                            name: "Lal Chowk Market Tour",
                            original_price: "600",
                            price: "450",
                            margin_percentage: "10",
                            images: [
                                { url: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", alt: "Market" },
                            ],
                        },
                    ],
                },
                {
                    day: 7,
                    title: "Departure",
                    description: "Check out and transfer to Srinagar Airport. Trek complete!",
                    hotel_days: "1",
                    meals: ["Breakfast"],
                    hotel: null,
                    activity_details: [],
                },
            ],
        },
    };

    // package hero

    // routes hero
    const routes = (Array.isArray(data.currentDuration.routes) ? data.currentDuration.routes : []) as any;
    const defaultRoute = routes.find((r: any) => r.is_default) ?? routes[0];
    const routeStops = defaultRoute.stops.map((stop: any) => ({
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
    const routesOption = (data.currentDuration.routes || []).map((r: any) => ({
        slug: r.slug,
        stops: r.stops.map((s: any) => s.p)
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
                images: i.hotel.images?.map(img => img.url) || [],
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