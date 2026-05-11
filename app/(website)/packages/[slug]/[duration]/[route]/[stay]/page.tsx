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

    const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
    const imgUrl = (key: string | null | undefined): string =>
        !key ? "" : key.startsWith("http") ? key : `${R2}/${key}`;

    const slug = pageData.slug;
    const duration = _duration;
    const route = _route;
    const stay = _stay;

    // ── Route stops ────────────────────────────────────────────────────────────
    const routeStops = (pageData.selectedRoute?.stops ?? []).map(s => ({
        days: s.stay_days,
        place: s.place_name,
    }));

    // ── Gallery images ─────────────────────────────────────────────────────────
    const packageImgUrls = pageData.images.map(img => imgUrl(img.url));
    const coverImage = imgUrl(pageData.thumbnail) || packageImgUrls[0] || "";
    const hotelImgUrls = [...new Set(
        pageData.itinerary.flatMap(d => d.hotel?.images.map(img => imgUrl(img.url)) ?? [])
    )].slice(0, 3);
    const activityImgUrls = [...new Set(
        pageData.itinerary.flatMap(d =>
            d.activities.flatMap(a => a.images.map(img => imgUrl(img.url)))
        )
    )].slice(0, 2);
    const image_gallery = [
        ...new Set([coverImage, ...hotelImgUrls, ...activityImgUrls, ...packageImgUrls])
    ].filter(Boolean).slice(0, 5);

    // ── Duration options ───────────────────────────────────────────────────────
    const durationOptions = pageData.durations.map((d, i) => ({
        slug: d.slug,
        label: d.label || `${d.days}D/${d.nights}N`,
        price: "",
        image_url: imgUrl(d.thumbnail_url) || packageImgUrls[i] || coverImage,
        isDefault: d.is_default,
    }));

    // ── Route options ──────────────────────────────────────────────────────────
    const routesOption = pageData.currentDuration.routes.map(r => ({
        slug: r.slug,
        stops: r.stops.map(s => s.place_name),
    }));

    // ── Stay category options ──────────────────────────────────────────────────
    const stayOptions = pageData.stay_categories.map(s => ({
        slug: s.slug,
        label: s.label,
    }));

    // ── Pricing ────────────────────────────────────────────────────────────────
    const discountedPrice = Math.ceil(
        pageData.itinerary.reduce((acc, d) => {
            const hotelCost = d.hotel?.price_per_night ?? 0;
            const activityCost = d.activities.reduce((s, a) => s + (a.pricingTiers[0]?.price ?? 0), 0);
            return acc + hotelCost + activityCost;
        }, 0)
    );
    const originalPrice = Math.ceil(
        pageData.itinerary.reduce((acc, d) => {
            const hotelCost = d.hotel
                ? (d.hotel.original_price ?? d.hotel.price_per_night)
                : 0;
            const activityCost = d.activities.reduce((s, a) => s + (a.pricingTiers[0]?.price ?? 0), 0);
            return acc + hotelCost + activityCost;
        }, 0)
    );

    // ── Itinerary ──────────────────────────────────────────────────────────────
    const itinerary: ItineraryDay[] = pageData.itinerary.map(d => ({
        day: d.day,
        title: d.title,
        description: d.description ?? "",
        notes: d.notes,
        sections: [
            // Transfers first (cab/vehicle sections)
            ...d.transfers.map(t => ({
                type: "cab" as const,
                from: { label: "Pickup", value: t.pickup_name ?? "–" },
                to:   { label: "Drop",   value: t.drop_name   ?? "–" },
                distance_km:      t.distance_km,
                vehicle_name:     t.vehicle_name,
                vehicle_type:     t.vehicle_type,
                vehicle_capacity: t.vehicle_capacity,
                num_vehicles:     t.num_vehicles,
                transfer_notes:   t.notes,
            })),
            // Hotel stay
            ...(d.hotel ? [{
                type: "stay" as const,
                nights: 1,
                hotelName: d.hotel.name,
                stars: d.hotel.star_rating ?? 0,
                checkIn: d.hotel.check_in_time ?? "",
                checkOut: d.hotel.check_out_time ?? "",
                inclusions: [],
                images: d.hotel.images.map(img => imgUrl(img.url)),
            }] : []),
            // Activities
            ...d.activities.map(a => ({
                type: "activity" as const,
                name: a.name,
                images: a.images.map(img => ({
                    src: imgUrl(img.url),
                    label: img.alt ?? a.name,
                })),
            })),
        ] as DaySection[],
    }));

    // ── Region fallback ────────────────────────────────────────────────────────
    const region = pageData.destination.region
        ? { label: pageData.destination.region.name, slug: pageData.destination.region.slug }
        : { label: pageData.destination.name, slug: pageData.destination.slug };

    return (
        <div>
            <PackageHero
                title={pageData.title}
                duration={`${pageData.currentDuration.days}D/${pageData.currentDuration.nights}N`}
                itinerary={routeStops}
                inclusions={[
                    { key: "transfer", label: "Transfer" },
                    { key: "stay", label: "Stay" },
                    { key: "breakfast", label: "Meal" },
                    { key: "sightseeing", label: "Activity" },
                ]}
                region={region}
                images={image_gallery}
            />

            <div className="flex gap-10 py-section-sm">
                <div className="flex-1">
                    <PackageTab slug={slug} duration={duration} route={route} stay={stay} />

                    <div className="py-6 flex flex-col gap-8">
                        <TripDuration
                            durationOptions={durationOptions}
                            baseURL={`/packages/${slug}`}
                            durationSlug={duration}
                            routeSlug={route}
                            staySlug={stay}
                        />

                        <DestinationRoutes
                            routeSlug={route}
                            routesOption={routesOption}
                            baseUrl={`/packages/${slug}`}
                            durationSlug={duration}
                            staySlug={stay}
                        />

                        <StayCategory
                            stayOptions={stayOptions}
                            baseURL={`/packages/${slug}`}
                            durationSlug={duration}
                            routeSlug={route}
                            staySlug={stay}
                        />

                        <ItinerarySection days={itinerary} />
                    </div>
                </div>

                <aside className="sticky top-(--header-height) w-[27%]">
                    <div className="flex flex-col gap-3">
                        <PricingCard
                            originalPrice={originalPrice}
                            discountedPrice={discountedPrice}
                            savings={originalPrice - discountedPrice}
                            packageName={pageData.title}
                        />
                        <CoupenCard
                            coupons={[
                                { code: "MH45DREAM", discount: 2000, description: "Coupon applied successfully", applied: true },
                                { code: "TH43MK982", discount: 2000, description: "Get Discount Before it disappears", applied: false },
                            ]}
                        />
                        <EnquiryForm
                            discountedPrice={discountedPrice}
                            savings={originalPrice - discountedPrice}
                            packageName={pageData.title}
                        />
                    </div>
                </aside>
            </div>
        </div>
    );
}
