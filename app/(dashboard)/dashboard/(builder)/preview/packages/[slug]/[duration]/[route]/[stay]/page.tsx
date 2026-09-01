import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowLeft, Eye } from "lucide-react";
import { fetchPackagePageData, getDurationStartingPrices } from "@/app/actions/packages/fetch-page-data";
import { getImageUrl, IMAGE_SIZES } from "@/app/lib/imageUrl";
import PackageHero from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/hero";
import PackageTab from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/PackageTab";
import TripDuration from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/inputs/TripDuration";
import StayCategory from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/inputs/StayCategory";
import PricingCard from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/SidebarCards/PricingCard";
import EnquiryForm from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/SidebarCards/EnquiryForm";
import ItinerarySection, { ItineraryDay, DaySection } from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/Itnary";
import DestinationRoutes from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/inputs/DestinationRoutes";
import { PackageBookingProvider, type StayRoomCount } from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/PackageBookingProvider";
import ShortNoticeBanner from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/ShortNoticeBanner";
import RelatedPackages from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/RelatedPackages";
import { CheckIcon, XMarkIcon, StarIcon } from "@heroicons/react/24/solid";
import { Card, CardBody } from "@/app/components/ui/Card";

// ─────────────────────────────────────────────────────────────────────────────
// Staff-only preview of a catalog package — the real public page
// (app/(website)/packages/[slug]/[duration]/[route]/[stay]/page.tsx) 404s any
// package with is_active: false, by design (an unpublished package must stay
// unreachable to the public). This route exists so staff can still see what a
// package — live or offline — actually looks like, e.g. from CreatePackageDialog's
// "View" button on a catalog card. Auth-only (see the (builder) layout this
// route sits under); reachable by any logged-in staff member regardless of
// their page-access list, since it's not a sidebar destination.
//
// Deliberately NOT a refactor of the public page.tsx — that file drives real
// revenue traffic and this duplicates its (pure, mechanical) data-shaping
// logic rather than touch it. What IS shared is every rendering component
// (PackageHero, PackageTab, ItinerarySection, …) and PackageBookingProvider's
// new `previewMode` flag, which the shared booking hook/enquiry form use to
// refuse to create a real quote or lead from what's meant to be a read-only
// look (see useBookQuote.ts / EnquiryForm.tsx).
//
// EnquiryAutoPopup (the timed "still interested?" popup) is deliberately
// left out — there's no real visitor here to nudge.
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a stored "HH:MM" (24-h) string to "h:MM AM/PM". Returns "" for null/empty. */
function formatTime12(t: string | null | undefined): string {
    if (!t) return "";
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr ?? "0", 10);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Expands a hotel meal-plan code / descriptive name into individual meal names. */
function expandMealPlan(mealType: string | null | undefined, planName: string | null | undefined): string[] {
    const raw = mealType ?? planName ?? "";
    const s = raw.toLowerCase();
    if (!s.trim()) return [];

    const found: string[] = [];
    if (s.includes("breakfast")) found.push("Breakfast");
    if (/morning[\s_-]*snack/.test(s)) found.push("Morning Snacks");
    if (s.includes("lunch")) found.push("Lunch");
    if (/evening[\s_-]*snack/.test(s)) found.push("Evening Snacks");
    if (s.includes("dinner")) found.push("Dinner");
    if (found.length) return found;

    const code = s.trim();
    if (code === "ap" || code === "full board") return ["Breakfast", "Lunch", "Dinner"];
    if (code === "map" || code === "half board") return ["Breakfast", "Dinner"];
    if (code === "cp" || code === "bb") return ["Breakfast"];
    if (code === "ep" || code === "room only") return [];
    return [];
}

function mealKey(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, "_");
}

function mealLabel(key: string): string {
    return key.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const MEAL_ORDER = ["breakfast", "morning_snacks", "lunch", "evening_snacks", "dinner"];

export default async function PackagePreviewPage({
    params,
}: {
    params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
}) {
    const { slug: _slug, duration: _duration, route: _route, stay: _stay } = await params;

    const pageData = await fetchPackagePageData(_slug, _duration, _route, _stay, {
        includeInactive: true,
        allowMissingStay: true,
    });

    if (!pageData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                <p className="text-lg font-semibold">Package not found</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    No package matches this slug/duration/route/stay combination — it may have been deleted, or the
                    stay category no longer exists.
                </p>
                <Link href="/dashboard/package-templates" className="text-sm text-primary hover:underline">
                    Back to Package Templates
                </Link>
            </div>
        );
    }

    const imgUrl = (k: string | null | undefined) => getImageUrl(k ?? "", IMAGE_SIZES.gallery);
    const imgUrlFull = (k: string | null | undefined) => getImageUrl(k ?? "", IMAGE_SIZES.lightbox);
    const imgUrlCard = (k: string | null | undefined) => getImageUrl(k ?? "", IMAGE_SIZES.card);
    const imgUrlThumb = (k: string | null | undefined) => getImageUrl(k ?? "", IMAGE_SIZES.thumbnail);

    const slug = pageData.slug;
    const duration = _duration;
    const route = _route;
    const stay = _stay;
    const baseURL = `/dashboard/preview/packages/${slug}`;

    // ── Route stops ────────────────────────────────────────────────────────────
    const routeStops = (pageData.selectedRoute?.stops ?? []).map((s) => ({
        days: s.stay_days,
        place: s.place_name,
    }));

    // ── Gallery images ─────────────────────────────────────────────────────────
    type GalleryImage = { src: string; fullSrc: string; label: string };

    const coverImage = imgUrl(pageData.thumbnail) || imgUrl(pageData.images[0]?.url) || "";

    const routeGallery = pageData.gallery.filter((g) => g.route_id === pageData.selectedRoute?.id);
    const assignedGallery = routeGallery.length > 0 ? routeGallery : pageData.gallery.filter((g) => g.route_id === null);

    let image_gallery: GalleryImage[];

    if (assignedGallery.length > 0) {
        image_gallery = assignedGallery.map((g) => ({
            src: imgUrl(g.image_url),
            fullSrc: imgUrlFull(g.image_url),
            label: g.label ?? "",
        }));
    } else {
        type Candidate = { src: string; fullSrc: string; label: string };
        const seen = new Set<string>();
        const fallback: GalleryImage[] = [];

        const addImg = (c: Candidate) => {
            if (c.src && !seen.has(c.src)) {
                seen.add(c.src);
                fallback.push(c);
                return true;
            }
            return false;
        };

        const coverFull = imgUrlFull(pageData.thumbnail) || imgUrlFull(pageData.images[0]?.url) || "";
        if (coverImage) addImg({ src: coverImage, fullSrc: coverFull, label: pageData.destination.name });

        const seenHotelIds = new Set<number>();
        const hotelImgCandidates: Candidate[] = [];
        const roomImgCandidates: Candidate[] = [];

        for (const d of pageData.itinerary) {
            const h = d.hotel;
            if (!h || seenHotelIds.has(h.id)) continue;
            seenHotelIds.add(h.id);
            for (const img of h.images) {
                const src = imgUrl(img.url);
                if (src) hotelImgCandidates.push({ src, fullSrc: imgUrlFull(img.url), label: "Hotel" });
            }
            for (const img of h.room_images) {
                const src = imgUrl(img.url);
                if (src) roomImgCandidates.push({ src, fullSrc: imgUrlFull(img.url), label: "Hotel Room" });
            }
        }

        for (const c of hotelImgCandidates) {
            if (addImg(c)) break;
        }

        let slot3Filled = false;
        for (const c of roomImgCandidates) {
            if (addImg(c)) {
                slot3Filled = true;
                break;
            }
        }
        if (!slot3Filled) {
            for (const c of hotelImgCandidates) {
                if (addImg(c)) break;
            }
        }

        const actGroups: { items: Candidate[] }[] = [];
        for (const d of pageData.itinerary) {
            for (const act of d.activities) {
                const items = act.images
                    .map((img) => ({ src: imgUrl(img.url), fullSrc: imgUrlFull(img.url), label: "Sightseeing" }))
                    .filter((c) => c.src);
                if (items.length) actGroups.push({ items });
            }
        }

        const usedActGroups = new Set<number>();
        for (let pass = 0; pass < 2; pass++) {
            if (fallback.length >= 5) break;
            for (let gi = 0; gi < actGroups.length; gi++) {
                if (fallback.length >= 5) break;
                if (usedActGroups.has(gi)) continue;
                const g = actGroups[gi];
                for (const item of g.items) {
                    if (addImg(item)) {
                        usedActGroups.add(gi);
                        break;
                    }
                }
            }
            if (pass === 0) usedActGroups.clear();
        }

        image_gallery = fallback;
    }

    type GalleryCat = { label: string; images: { src: string; fullSrc: string; label: string }[] };
    const fullGallery: GalleryCat[] = [];

    if (image_gallery.length > 0) fullGallery.push({ label: "Gallery", images: image_gallery });

    const seenHotelGalleryIds = new Set<number>();
    const hotelGalleryImgs: { src: string; fullSrc: string; label: string }[] = [];
    for (const d of pageData.itinerary) {
        const h = d.hotel;
        if (!h || seenHotelGalleryIds.has(h.id)) continue;
        seenHotelGalleryIds.add(h.id);
        for (const img of h.images) {
            const src = imgUrl(img.url);
            if (src) hotelGalleryImgs.push({ src, fullSrc: imgUrlFull(img.url), label: h.name });
        }
    }
    if (hotelGalleryImgs.length > 0) fullGallery.push({ label: "Hotels", images: hotelGalleryImgs });

    const seenRoomHotelIds = new Set<number>();
    const roomGalleryImgs: { src: string; fullSrc: string; label: string }[] = [];
    for (const d of pageData.itinerary) {
        const h = d.hotel;
        if (!h || seenRoomHotelIds.has(h.id)) continue;
        seenRoomHotelIds.add(h.id);
        for (const img of h.room_images) {
            const src = imgUrl(img.url);
            if (src) roomGalleryImgs.push({ src, fullSrc: imgUrlFull(img.url), label: h.room_name ?? "Room" });
        }
    }
    if (roomGalleryImgs.length > 0) fullGallery.push({ label: "Rooms", images: roomGalleryImgs });

    const seenActivityGalleryIds = new Set<number>();
    const actGalleryImgs: { src: string; fullSrc: string; label: string }[] = [];
    for (const d of pageData.itinerary) {
        for (const act of d.activities) {
            if (seenActivityGalleryIds.has(act.id)) continue;
            seenActivityGalleryIds.add(act.id);
            for (const img of act.images) {
                const src = imgUrl(img.url);
                if (src) actGalleryImgs.push({ src, fullSrc: imgUrlFull(img.url), label: img.label ?? act.name });
            }
        }
    }
    if (actGalleryImgs.length > 0) fullGallery.push({ label: "Activities", images: actGalleryImgs });

    // ── Duration options (with "starting from" per-adult price) ─────────────────
    const startingStayId =
        pageData.stay_categories.find((s) => s.is_default)?.id
        ?? pageData.selectedStay?.id
        ?? pageData.stay_categories[0]?.id;
    const initialPriceOccupancy = {
        adults: 2,
        children: 0,
        childAges: [] as number[],
        travelDate: new Date().toISOString().slice(0, 10),
    };
    const durationPrices = startingStayId
        ? await getDurationStartingPrices(pageData.id, pageData.durations.map((d) => d.id), startingStayId, initialPriceOccupancy)
        : new Map();

    const durationOptions = pageData.durations.map((d, i) => {
        const info = durationPrices.get(d.id);
        return {
            slug: d.slug,
            label: d.label || `${d.days}D/${d.nights}N`,
            price: info?.pricePerAdult ? `₹${info.pricePerAdult.toLocaleString("en-IN")}` : "",
            image_url: imgUrlCard(d.thumbnail_url) || imgUrlCard(pageData.images[i]?.url) || coverImage,
            isDefault: d.is_default,
            durationId: d.id,
            routeId: info?.routeId ?? null,
        };
    });

    const routesOption = pageData.currentDuration.routes.map((r) => ({
        slug: r.slug,
        stops: r.stops.map((s) => s.place_name),
    }));

    const stayOptions = pageData.stay_categories.map((s) => ({
        slug: s.slug,
        label: s.label,
    }));

    const getCabForDay = (day: number) => {
        const covering = pageData.cabTypes.filter((ct) => ct.segments.some((s) => s.day_from <= day && day <= s.day_to));
        return covering.find((ct) => ct.is_default) ?? covering[0] ?? null;
    };

    // ── Itinerary ──────────────────────────────────────────────────────────────
    const hotelRunStart = new Map<number, number>();
    for (let i = 0; i < pageData.itinerary.length; i++) {
        const d = pageData.itinerary[i];
        if (!d.hotel) continue;
        const prev = pageData.itinerary[i - 1];
        if (prev?.hotel?.id === d.hotel.id) continue;
        let nights = 1;
        for (let j = i + 1; j < pageData.itinerary.length; j++) {
            if (pageData.itinerary[j].hotel?.id === d.hotel.id) nights++;
            else break;
        }
        hotelRunStart.set(d.day, nights);
    }

    const itinerary: ItineraryDay[] = pageData.itinerary.map((d, dayIdx) => {
        type SortableSection = DaySection & { _sort: number };

        const dayCab = getCabForDay(d.day);

        const transferSections: SortableSection[] = d.transfers.map((t) => ({
            _sort: t.sort_order,
            type: "cab" as const,
            from: { label: "Pickup", value: t.pickup_name ?? "–", locationType: t.pickup_location_type },
            to: { label: "Drop", value: t.drop_name ?? "–", locationType: t.drop_location_type },
            distance_km: t.distance_km,
            vehicle_name: t.vehicle_name ?? dayCab?.label ?? null,
            vehicle_type: t.vehicle_type ?? dayCab?.vehicle.type ?? null,
            vehicle_capacity: t.vehicle_capacity ?? dayCab?.vehicle.passenger_capacity ?? null,
            vehicle_image: imgUrlThumb(t.vehicle_image_key) || imgUrlThumb(dayCab?.vehicle.image_key),
            num_vehicles: t.num_vehicles,
            transfer_notes: t.notes,
        }));

        const runNights = d.hotel ? hotelRunStart.get(d.day) : undefined;
        const hotelSections: SortableSection[] = (d.hotel && runNights !== undefined) ? [{
            _sort: d.hotel.sort_order,
            type: "stay" as const,
            itineraryStayId: d.hotel.itinerary_stay_id,
            hotelId: d.hotel.id,
            destinationId: d.hotel.destination_id,
            roomPricingId: d.hotel.room_pricing_id,
            pricePerNight: d.hotel.price_per_night,
            nights: runNights,
            dayNumber: d.day,
            hotelName: d.hotel.name,
            stayType: d.hotel.stay_type ?? null,
            checkIn: formatTime12(d.hotel.check_in_time),
            checkOut: formatTime12(d.hotel.check_out_time),
            address: d.hotel.address,
            location: d.hotel.location,
            inclusions: [],
            roomName: d.hotel.room_name,
            roomCapacity: d.hotel.room_capacity,
            roomBedType: d.hotel.room_bed_type,
            roomAreaSqft: d.hotel.room_area_sqft,
            roomView: d.hotel.room_view,
            roomExtraBeds: d.hotel.room_extra_beds,
            activeMeals: d.hotel.active_meals,
            mealType: d.hotel.meal_type,
            planName: d.hotel.plan_name,
            images: (() => {
                const hotelPool = d.hotel.images.map((img) => imgUrlCard(img.url)).filter(Boolean) as string[];
                const roomPool = d.hotel.room_images.map((img) => imgUrlCard(img.url)).filter(Boolean) as string[];
                const take = (primary: string[], fallback: string[]) => primary.shift() ?? fallback.shift();
                const slots: string[] = [];
                const s1 = take(hotelPool, roomPool);
                if (s1) slots.push(s1);
                for (let i = 0; i < 2; i++) {
                    const v = take(roomPool, hotelPool);
                    if (v) slots.push(v);
                }
                for (let i = 0; i < 2; i++) {
                    const v = take(hotelPool, roomPool);
                    if (v) slots.push(v);
                }
                return slots;
            })(),
        }] : [];

        const activitySections: SortableSection[] = d.activities.map((a) => ({
            _sort: a.sort_order,
            type: "activity" as const,
            name: a.name,
            description: a.description,
            duration_hours: a.duration_hours,
            difficulty: a.difficulty,
            category: a.category,
            is_optional: a.is_optional,
            pricingTiers: a.pricingTiers,
            images: a.images.map((img) => ({
                src: imgUrlCard(img.url),
                label: img.label ?? img.alt ?? a.category ?? a.name,
            })),
        }));

        const sections = [...transferSections, ...hotelSections, ...activitySections]
            .sort((a, b) => a._sort - b._sort)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map(({ _sort, ...s }) => s as DaySection);

        const chosen = new Map<string, string | null>();

        const prevHotel = pageData.itinerary[dayIdx - 1]?.hotel ?? null;
        if (prevHotel) {
            const pm = prevHotel.active_meals.length > 0
                ? prevHotel.active_meals
                : expandMealPlan(prevHotel.meal_type, prevHotel.plan_name);
            if (pm.some((m) => mealKey(m) === "breakfast")) chosen.set("breakfast", prevHotel.name);
        }
        if (d.hotel) {
            const hm = d.hotel.active_meals.length > 0
                ? d.hotel.active_meals
                : expandMealPlan(d.hotel.meal_type, d.hotel.plan_name);
            for (const m of hm) {
                const k = mealKey(m);
                if (k === "breakfast") continue;
                if (!chosen.has(k)) chosen.set(k, d.hotel.name);
            }
        }
        const excluded = new Set((d.excluded_meals ?? []).map(mealKey));
        for (const a of d.activities) {
            for (const m of (a.included_meals ?? [])) {
                const k = mealKey(m);
                if (excluded.has(k) || chosen.has(k)) continue;
                chosen.set(k, a.name);
            }
        }
        for (const m of (d.meals ?? [])) {
            const k = mealKey(m);
            if (!chosen.has(k)) chosen.set(k, null);
        }

        if (chosen.size > 0) {
            const ordered = [...chosen.keys()].sort((a, b) => {
                const ia = MEAL_ORDER.indexOf(a), ib = MEAL_ORDER.indexOf(b);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
            const mealItems = ordered.map((k) => ({ name: mealLabel(k), source: chosen.get(k) ?? null }));
            sections.push({ type: "meal", items: mealItems } as DaySection);
        }

        const attractions = d.attractions.map((a) => ({
            imageUrl: imgUrlThumb(a.image_key),
            fullImageUrl: imgUrl(a.image_key),
            caption: a.caption,
        }));

        return { day: d.day, title: d.title, description: d.description ?? "", notes: d.notes, sections, attractions };
    });

    const region = pageData.destination.region
        ? { label: pageData.destination.region.name, slug: pageData.destination.region.slug }
        : { label: pageData.destination.name, slug: pageData.destination.slug };

    const stayRoomCounts: StayRoomCount[] = [];
    const seenStayIds = new Set<number>();
    for (const day of pageData.itinerary) {
        const h = day.hotel;
        if (!h || seenStayIds.has(h.itinerary_stay_id)) continue;
        seenStayIds.add(h.itinerary_stay_id);
        stayRoomCounts.push({
            itineraryStayId: h.itinerary_stay_id,
            roomPricingId: h.room_pricing_id,
            hotelId: h.id,
            numRooms: h.room_num_rooms,
            roomCapacity: h.room_capacity,
            roomExtraBeds: h.room_extra_beds,
            roomTotalCapacity: h.room_total_capacity,
        });
    }

    return (
        <div className="min-h-screen bg-dashboard-base-200">
            {/* Staff preview chrome — deliberately not the public site header */}
            <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-dashboard-base-300 bg-dashboard-base-100 px-4 py-2.5">
                <Link href="/dashboard/package-templates" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Link>
                <span className="h-4 w-px bg-dashboard-base-300 shrink-0" />
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold shrink-0">
                    <Eye className="h-4 w-4 text-primary" /> Staff Preview
                </span>
                <span className="text-sm text-muted-foreground truncate">{pageData.title}</span>
                <div className="flex-1" />
                {!pageData.is_active && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2.5 py-1 shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" /> Offline — not published on the public site
                    </span>
                )}
            </div>

            <PackageBookingProvider
                packageId={pageData.id}
                durationId={pageData.currentDuration.id}
                routeId={pageData.selectedRoute!.id}
                stayCategoryId={pageData.selectedStay!.id}
                packageName={pageData.title}
                recentEnquiryCount={pageData.recentEnquiryCount}
                cabTypes={pageData.cabTypes}
                stayRoomCounts={stayRoomCounts}
                previewMode
            >
                <div className="screen-space pt-6 pb-10">
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
                        fullGallery={fullGallery}
                    />

                    <PackageTab
                        pricing={<PricingCard />}
                        coupon={null}
                        enquiry={<EnquiryForm packageName={pageData.title} destination={pageData.destination.name} />}
                        itinerary={
                            <div className="flex flex-col gap-8">
                                <TripDuration
                                    durationOptions={durationOptions}
                                    baseURL={baseURL}
                                    durationSlug={duration}
                                    routeSlug={route}
                                    staySlug={stay}
                                    packageId={pageData.id}
                                    stayCategoryId={startingStayId ?? pageData.selectedStay!.id}
                                />
                                <DestinationRoutes
                                    routeSlug={route}
                                    routesOption={routesOption}
                                    baseUrl={baseURL}
                                    durationSlug={duration}
                                    staySlug={stay}
                                />
                                <StayCategory
                                    stayOptions={stayOptions}
                                    baseURL={baseURL}
                                    durationSlug={duration}
                                    routeSlug={route}
                                    staySlug={stay}
                                />
                                <ShortNoticeBanner />
                                <ItinerarySection days={itinerary} />
                            </div>
                        }
                        highlights={
                            <div className="flex flex-col gap-8">
                                {pageData.description && (
                                    <p className="text-sm text-secondary leading-relaxed">{pageData.description}</p>
                                )}

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
                                                                                        <StarIcon key={i} className={`size-2.5 ${i < count ? "text-amber-400" : "text-neutral-200"}`} />
                                                                                    ))}
                                                                                </span>
                                                                                : <span className="text-muted text-xs">{d.hotel.stay_type}</span>;
                                                                        })()}
                                                                    </span>
                                                                ) : "–"}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-sm text-secondary">
                                                                {d.hotel
                                                                    ? (d.hotel.active_meals.length > 0
                                                                        ? d.hotel.active_meals.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")
                                                                        : d.hotel.meal_type ?? d.hotel.plan_name ?? "–")
                                                                    : "–"}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-sm text-secondary">
                                                                {d.activities.length > 0 ? d.activities.map((a) => a.name).join(", ") : "–"}
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
                                            policy.type === "CANCELLATION" ? "Cancellation Policy"
                                                : policy.type === "DATE_CHANGE" ? "Date Change Policy"
                                                    : policy.type === "REFUND" ? "Refund Policy"
                                                        : policy.type === "TERMS_AND_CONDITIONS" ? "Terms & Conditions"
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
                </div>

                <Suspense fallback={null}>
                    <RelatedPackages currentPackageId={pageData.id} destinationId={pageData.destination_id} />
                </Suspense>
            </PackageBookingProvider>
        </div>
    );
}
