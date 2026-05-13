import { notFound } from "next/navigation";
import { fetchPackagePageData, getActivePackageParams } from "@/app/actions/packages/fetch-page-data";
import PackageHero from "./components/hero";
import PackageTab from "./components/PackageTab";
import TripDuration from "./components/inputs/TripDuration";
import StayCategory from "./components/inputs/StayCategory";
import PricingCard from "./components/SidebarCards/PricingCard";
import EnquiryForm from "./components/SidebarCards/EnquiryForm";
import ItinerarySection, { ItineraryDay, DaySection } from "./components/Itnary";
import DestinationRoutes from "./components/inputs/DestinationRoutes";
import { PackageBookingProvider } from "./components/PackageBookingProvider";
import TravelerInputBar from "./components/TravelerInputBar";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Card, CardBody } from "@/app/components/ui/Card";

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

    console.log(pageData);

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

    // ── Starting point (first route stop or destination) ──────────────────────
    const startingFrom =
        pageData.selectedRoute?.stops[0]?.place_name ??
        pageData.destination.name;

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
                address: d.hotel.address,
                inclusions: [],
                roomName: d.hotel.room_name,
                roomCapacity: d.hotel.room_capacity,
                mealType: d.hotel.meal_type,
                planName: d.hotel.plan_name,
                images: [
                    d.hotel.images[0],
                    d.hotel.room_images[0], d.hotel.room_images[1],
                    d.hotel.images[1], d.hotel.images[2],
                    d.hotel.images[3], d.hotel.images[4],
                ].filter(img => img?.url).map(img => imgUrl(img!.url)).slice(0, 5),
            }] : []),
            // Activities
            ...d.activities.map(a => ({
                type: "activity" as const,
                name: a.name,
                images: a.images.map(img => ({
                    src: imgUrl(img.url),
                    label: img.label ?? img.alt ?? a.category ?? a.name,
                })),
            })),
        ] as DaySection[],
    }));

    // ── Region fallback ────────────────────────────────────────────────────────
    const region = pageData.destination.region
        ? { label: pageData.destination.region.name, slug: pageData.destination.region.slug }
        : { label: pageData.destination.name, slug: pageData.destination.slug };

    return (
        <PackageBookingProvider
            packageId={pageData.id}
            durationId={pageData.currentDuration.id}
            routeId={pageData.selectedRoute!.id}
            stayCategoryId={pageData.selectedStay!.id}
            packageName={pageData.title}
        >
            <TravelerInputBar startingFrom={startingFrom} />

            <PackageHero
                title={pageData.title}
                duration={`${pageData.currentDuration.days}D/${pageData.currentDuration.nights}N`}
                itinerary={routeStops}
                inclusions={[
                    { key: "transfer",    label: "Transfer" },
                    { key: "stay",        label: "Stay" },
                    { key: "breakfast",   label: "Meal" },
                    { key: "sightseeing", label: "Activity" },
                ]}
                region={region}
                images={image_gallery}
            />

            <PackageTab
                    pricing={<PricingCard />}
                    coupon={null}
                    enquiry={<EnquiryForm packageName={pageData.title} />}
                        itinerary={
                            <div className="flex flex-col gap-8">
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
                        }
                        highlights={
                            <div className="flex flex-col gap-8">
                                {pageData.description && (
                                    <p className="text-sm text-secondary leading-relaxed">{pageData.description}</p>
                                )}

                                {/* Inclusions / Exclusions */}
                                <div className="grid grid-cols-2 gap-6">
                                    {pageData.inclusions.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">What&apos;s Included</p>
                                            <ul className="flex flex-col gap-2">
                                                {pageData.inclusions.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <CheckIcon className="size-4 text-success-600 shrink-0 mt-0.5" />
                                                        <span className="text-sm text-secondary">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {pageData.exclusions.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Not Included</p>
                                            <ul className="flex flex-col gap-2">
                                                {pageData.exclusions.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <XMarkIcon className="size-4 text-error-500 shrink-0 mt-0.5" />
                                                        <span className="text-sm text-secondary">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Day-by-day summary table */}
                                {pageData.itinerary.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Day-by-Day Summary</p>
                                        <div className="rounded-xl overflow-hidden border border-neutral-200">
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-neutral-50 border-b border-neutral-200 text-left">
                                                        <th className="px-3 py-2.5 text-[11px] font-semibold text-muted w-14">Day</th>
                                                        <th className="px-3 py-2.5 text-[11px] font-semibold text-muted">Title</th>
                                                        <th className="px-3 py-2.5 text-[11px] font-semibold text-muted">Hotel</th>
                                                        <th className="px-3 py-2.5 text-[11px] font-semibold text-muted">Meals</th>
                                                        <th className="px-3 py-2.5 text-[11px] font-semibold text-muted">Activities</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pageData.itinerary.map((d) => (
                                                        <tr key={d.day} className="border-b border-neutral-100 last:border-none">
                                                            <td className="px-3 py-2.5 text-xs font-bold text-brand">Day {d.day}</td>
                                                            <td className="px-3 py-2.5 text-sm font-medium text-primary">{d.title}</td>
                                                            <td className="px-3 py-2.5 text-sm text-secondary">
                                                                {d.hotel ? (
                                                                    <span>{d.hotel.name}{d.hotel.star_rating ? ` ${'★'.repeat(d.hotel.star_rating)}` : ''}</span>
                                                                ) : '–'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-sm text-secondary">
                                                                {d.hotel?.meal_type ?? d.hotel?.plan_name ?? '–'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-sm text-secondary">
                                                                {d.activities.length > 0
                                                                    ? d.activities.map(a => a.name).join(', ')
                                                                    : '–'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        }
                        policies={
                            <div className="flex flex-col gap-8">
                                {pageData.policies.length === 0 ? (
                                    <p className="text-sm text-secondary">No policies have been assigned to this package.</p>
                                ) : (
                                    pageData.policies.map((policy, i) => {
                                        const label =
                                            policy.type === 'CANCELLATION'           ? 'Cancellation Policy'
                                            : policy.type === 'DATE_CHANGE'          ? 'Date Change Policy'
                                            : policy.type === 'REFUND'               ? 'Refund Policy'
                                            : policy.type === 'TERMS_AND_CONDITIONS' ? 'Terms & Conditions'
                                            : policy.title;
                                        return (
                                            <Card key={i} variant="default" padding="none">
                                                <CardBody className="p-4 flex flex-col gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-primary">{label}</p>
                                                        {policy.title !== label && (
                                                            <p className="text-xs text-muted mt-0.5">{policy.title}</p>
                                                        )}
                                                    </div>
                                                    <ul className="flex flex-col gap-1.5">
                                                        {policy.points.map((point, j) => (
                                                            <li key={j} className="flex items-start gap-2">
                                                                <span className="size-1.5 rounded-full bg-neutral-400 shrink-0 mt-1.75" />
                                                                <span className="text-sm text-secondary leading-relaxed">{point}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </CardBody>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        }
                    />
        </PackageBookingProvider>
    );
}
