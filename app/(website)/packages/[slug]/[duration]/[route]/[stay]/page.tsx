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
import { CheckIcon, XMarkIcon, StarIcon } from "@heroicons/react/24/solid";
import { Card, CardBody } from "@/app/components/ui/Card";

// export const revalidate = 3600; // TODO: re-enable ISR for production
export const dynamic = 'force-dynamic';

/** Converts a stored "HH:MM" (24-h) string to "h:MM AM/PM". Returns "" for null/empty. */
function formatTime12(t: string | null | undefined): string {
    if (!t) return '';
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr ?? '0', 10);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

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

    // ── Default cab type lookup ────────────────────────────────────────────────
    // For each day, find the default cab type whose segment covers that day.
    // Used as fallback when a transfer has no per-transfer vehicle assigned.
    const getCabForDay = (day: number) => {
        const covering = pageData.cabTypes.filter(ct =>
            ct.segments.some(s => s.day_from <= day && day <= s.day_to)
        );
        return covering.find(ct => ct.is_default) ?? covering[0] ?? null;
    };

    // ── Itinerary ──────────────────────────────────────────────────────────────
    const itinerary: ItineraryDay[] = pageData.itinerary.map(d => {
        type SortableSection = DaySection & { _sort: number };

        // Default cab type for this day (from PricingTab cab options)
        const dayCab = getCabForDay(d.day);

        const transferSections: SortableSection[] = d.transfers.map(t => ({
            _sort: t.sort_order,
            type: "cab" as const,
            from: { label: "Pickup", value: t.pickup_name ?? "–", locationType: t.pickup_location_type },
            to:   { label: "Drop",   value: t.drop_name   ?? "–", locationType: t.drop_location_type   },
            distance_km:      t.distance_km,
            // Prefer per-transfer vehicle; fall back to default cab type for this day
            vehicle_name:     t.vehicle_name     ?? dayCab?.label                        ?? null,
            vehicle_type:     t.vehicle_type     ?? dayCab?.vehicle.type                 ?? null,
            vehicle_capacity: t.vehicle_capacity ?? dayCab?.vehicle.passenger_capacity   ?? null,
            vehicle_image:    imgUrl(t.vehicle_image_key) || imgUrl(dayCab?.vehicle.image_key),
            num_vehicles:     t.num_vehicles,
            transfer_notes:   t.notes,
        }));

        const hotelSections: SortableSection[] = d.hotel ? [{
            _sort: d.hotel.sort_order,
            type: "stay" as const,
            nights: 1,
            hotelName: d.hotel.name,
            stayType: d.hotel.stay_type ?? null,
            checkIn: formatTime12(d.hotel.check_in_time),
            checkOut: formatTime12(d.hotel.check_out_time),
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
        }] : [];

        const activitySections: SortableSection[] = d.activities.map(a => ({
            _sort: a.sort_order,
            type: "activity" as const,
            name: a.name,
            description:    a.description,
            duration_hours: a.duration_hours,
            difficulty:     a.difficulty,
            category:       a.category,
            is_optional:    a.is_optional,
            pricingTiers:   a.pricingTiers,
            images: a.images.map(img => ({
                src: imgUrl(img.url),
                label: img.label ?? img.alt ?? a.category ?? a.name,
            })),
        }));

        const sections = [...transferSections, ...hotelSections, ...activitySections]
            .sort((a, b) => a._sort - b._sort)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map(({ _sort, ...s }) => s as DaySection);

        const attractions = d.attractions.map(a => ({
            imageUrl: imgUrl(a.image_key),
            caption: a.caption,
        }));

        return { day: d.day, title: d.title, description: d.description ?? "", notes: d.notes, sections, attractions };
    });

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
                                                                    <span className="flex items-center gap-1.5 flex-wrap">
                                                                        <span>{d.hotel.name}</span>
                                                                        {d.hotel.stay_type && (() => {
                                                                            const count = parseInt(d.hotel.stay_type) || 0;
                                                                            return count >= 1 && count <= 5
                                                                                ? <span className="flex items-center gap-0.5 shrink-0">
                                                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                                                        <StarIcon key={i} className={`size-2.5 ${i < count ? 'text-amber-400' : 'text-neutral-200'}`} />
                                                                                    ))}
                                                                                  </span>
                                                                                : <span className="text-muted text-xs">{d.hotel.stay_type}</span>;
                                                                        })()}
                                                                    </span>
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
