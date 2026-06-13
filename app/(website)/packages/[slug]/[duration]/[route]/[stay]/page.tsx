import { notFound } from "next/navigation";
import { fetchPackagePageData, getActivePackageParams, getDurationStartingPrices } from "@/app/actions/packages/fetch-page-data";
import PackageHero from "./components/hero";
import PackageTab from "./components/PackageTab";
import PackageScrollReset from "./components/PackageScrollReset";
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
import RelatedPackages from "./components/RelatedPackages";

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

/**
 * Expands a hotel meal-plan code / descriptive name into individual meal names.
 * Detects the meal keywords present in the string (so a descriptive name like
 * "AP (Breakfast, Dinner)" or "CP (Breakfast Only)" resolves correctly) and
 * only falls back to plan codes (AP/MAP/CP/EP) when no keyword is found.
 * NOTE: never naively comma-splits — that mangled names like "AP (breakfast, Dinner)".
 */
function expandMealPlan(mealType: string | null | undefined, planName: string | null | undefined): string[] {
    const raw = mealType ?? planName ?? '';
    const s = raw.toLowerCase();
    if (!s.trim()) return [];

    // 1) Explicit meal mentions (returned in canonical time order)
    const found: string[] = [];
    if (s.includes('breakfast')) found.push('Breakfast');
    if (/morning[\s_-]*snack/.test(s)) found.push('Morning Snacks');
    if (s.includes('lunch')) found.push('Lunch');
    if (/evening[\s_-]*snack/.test(s)) found.push('Evening Snacks');
    if (s.includes('dinner')) found.push('Dinner');
    if (found.length) return found;

    // 2) Bare plan codes
    const code = s.trim();
    if (code === 'ap' || code === 'full board') return ['Breakfast', 'Lunch', 'Dinner'];
    if (code === 'map' || code === 'half board') return ['Breakfast', 'Dinner'];
    if (code === 'cp' || code === 'bb') return ['Breakfast'];
    if (code === 'ep' || code === 'room only') return [];
    return [];
}

/** "BREAKFAST" | "Morning Snacks" → "breakfast" | "morning_snacks" */
function mealKey(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, "_");
}

/** "morning_snacks" → "Morning Snacks" */
function mealLabel(key: string): string {
    return key.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const MEAL_ORDER = ["breakfast", "morning_snacks", "lunch", "evening_snacks", "dinner"];

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
    searchParams,
}: {
    params: Promise<{ slug: string; duration: string; route: string; stay: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { slug: _slug, duration: _duration, route: _route, stay: _stay } = await params;
    const sp = await searchParams;

    const pageData = await fetchPackagePageData(_slug, _duration, _route, _stay);
    if (!pageData) notFound();

    // ── Booking pre-fill carried from the search page (all optional) ──────────
    const spStr = (v: string | string[] | undefined) =>
        typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
    const initialAdults = Math.max(1, parseInt(spStr(sp.adults) || "0", 10) || 0) || undefined;
    const initialChildAges = spStr(sp.children)
        ? spStr(sp.children).split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n))
        : undefined;
    const initialTravelDate = spStr(sp.date) || undefined;
    const fromId = spStr(sp.from);
    const initialLeavingFrom = fromId
        ? {
              id: fromId,
              name: spStr(sp.fromName) || "Selected city",
              type: (spStr(sp.fromType) || "CITY") as never,
              breadcrumb: spStr(sp.fromName) || "",
              slug: "",
          }
        : null;

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
    type GalleryImage = { src: string; label: string };

    const coverImage = imgUrl(pageData.thumbnail) || imgUrl(pageData.images[0]?.url) || "";

    // Route-specific gallery takes priority; fall back to package-level (route_id null)
    const routeGallery = pageData.gallery.filter(g => g.route_id === pageData.selectedRoute?.id);
    const assignedGallery = routeGallery.length > 0
        ? routeGallery
        : pageData.gallery.filter(g => g.route_id === null);

    let image_gallery: GalleryImage[];

    if (assignedGallery.length > 0) {
        image_gallery = assignedGallery.map(g => ({
            src: imgUrl(g.image_url),
            label: g.label ?? '',
        }));
    } else {
        // Fallback slot rules:
        //   1 — thumbnail                (label: destination name)
        //   2 — first hotel image        (label: "Hotel")
        //   3 — first room image; if none, another hotel image  (label: "Hotel Room" or "Hotel")
        //   4 — first activity image     (label: "Sightseeing")
        //   5 — second activity image from a different activity if possible  (label: "Sightseeing")
        const seen = new Set<string>();
        const fallback: GalleryImage[] = [];

        const addImg = (url: string, label: string) => {
            if (url && !seen.has(url)) { seen.add(url); fallback.push({ src: url, label }); return true; }
            return false;
        };

        // Slot 1 — cover / thumbnail
        if (coverImage) addImg(coverImage, pageData.destination.name);

        // Collect hotel + room candidates in itinerary order (deduplicated by hotel id)
        const seenHotelIds = new Set<number>();
        const hotelImgCandidates: GalleryImage[] = [];   // hotel exterior images
        const roomImgCandidates: GalleryImage[] = [];   // room images

        for (const d of pageData.itinerary) {
            const h = d.hotel;
            if (!h || seenHotelIds.has(h.id)) continue;
            seenHotelIds.add(h.id);
            for (const img of h.images) {
                const url = imgUrl(img.url);
                if (url) hotelImgCandidates.push({ src: url, label: 'Hotel' });
            }
            for (const img of h.room_images) {
                const url = imgUrl(img.url);
                if (url) roomImgCandidates.push({ src: url, label: 'Hotel Room' });
            }
        }

        // Slot 2 — first hotel image
        for (const c of hotelImgCandidates) { if (addImg(c.src, c.label)) break; }

        // Slot 3 — first room image; fall back to next hotel image
        let slot3Filled = false;
        for (const c of roomImgCandidates) { if (addImg(c.src, c.label)) { slot3Filled = true; break; } }
        if (!slot3Filled) {
            for (const c of hotelImgCandidates) { if (addImg(c.src, c.label)) break; }
        }

        // Collect activity image candidates grouped by activity (to prefer different activities)
        const actGroups: { label: string; urls: string[] }[] = [];
        for (const d of pageData.itinerary) {
            for (const act of d.activities) {
                const urls = act.images.map(img => imgUrl(img.url)).filter(Boolean) as string[];
                if (urls.length) actGroups.push({ label: 'Sightseeing', urls });
            }
        }

        // Slots 4 & 5 — one image per activity group, then overflow if needed
        const usedActGroups = new Set<number>();
        for (let pass = 0; pass < 2; pass++) {
            if (fallback.length >= 5) break;
            for (let gi = 0; gi < actGroups.length; gi++) {
                if (fallback.length >= 5) break;
                if (usedActGroups.has(gi)) continue;
                const g = actGroups[gi];
                for (const url of g.urls) {
                    if (addImg(url, g.label)) { usedActGroups.add(gi); break; }
                }
            }
            // Second pass allows revisiting same activity if we still need images
            if (pass === 0) usedActGroups.clear();
        }

        image_gallery = fallback;
    }

    // ── Full gallery categories (for the gallery overlay) ─────────────────────
    type GalleryCat = { label: string; images: { src: string; label: string }[] };
    const fullGallery: GalleryCat[] = [];

    if (image_gallery.length > 0) {
        fullGallery.push({ label: 'Gallery', images: image_gallery });
    }

    // Hotels
    const seenHotelGalleryIds = new Set<number>();
    const hotelGalleryImgs: { src: string; label: string }[] = [];
    for (const d of pageData.itinerary) {
        const h = d.hotel;
        if (!h || seenHotelGalleryIds.has(h.id)) continue;
        seenHotelGalleryIds.add(h.id);
        for (const img of h.images) {
            const src = imgUrl(img.url);
            if (src) hotelGalleryImgs.push({ src, label: h.name });
        }
    }
    if (hotelGalleryImgs.length > 0) fullGallery.push({ label: 'Hotels', images: hotelGalleryImgs });

    // Rooms
    const seenRoomHotelIds = new Set<number>();
    const roomGalleryImgs: { src: string; label: string }[] = [];
    for (const d of pageData.itinerary) {
        const h = d.hotel;
        if (!h || seenRoomHotelIds.has(h.id)) continue;
        seenRoomHotelIds.add(h.id);
        for (const img of h.room_images) {
            const src = imgUrl(img.url);
            if (src) roomGalleryImgs.push({ src, label: h.room_name ?? 'Room' });
        }
    }
    if (roomGalleryImgs.length > 0) fullGallery.push({ label: 'Rooms', images: roomGalleryImgs });

    // Activities
    const seenActivityGalleryIds = new Set<number>();
    const actGalleryImgs: { src: string; label: string }[] = [];
    for (const d of pageData.itinerary) {
        for (const act of d.activities) {
            if (seenActivityGalleryIds.has(act.id)) continue;
            seenActivityGalleryIds.add(act.id);
            for (const img of act.images) {
                const src = imgUrl(img.url);
                if (src) actGalleryImgs.push({ src, label: img.label ?? act.name });
            }
        }
    }
    if (actGalleryImgs.length > 0) fullGallery.push({ label: 'Activities', images: actGalleryImgs });

    // ── Duration options (with "starting from" per-adult price) ─────────────────
    // Use the DEFAULT stay category (matching the pricing card's default config),
    // not the cheapest — otherwise the duration price reads ~half the card.
    const startingStayId =
        pageData.stay_categories.find(s => s.is_default)?.id
        ?? pageData.selectedStay?.id
        ?? pageData.stay_categories[0]?.id;
    // Initial price uses the occupancy carried from search (falls back to 2 adults);
    // the client recomputes per duration as the traveller count changes.
    const initialPriceOccupancy = {
        adults: initialAdults ?? 2,
        children: (initialChildAges ?? []).length,
        childAges: initialChildAges ?? [],
        travelDate: initialTravelDate ?? null,
    };
    const durationPrices = startingStayId
        ? await getDurationStartingPrices(pageData.id, pageData.durations.map(d => d.id), startingStayId, initialPriceOccupancy)
        : new Map();

    const durationOptions = pageData.durations.map((d, i) => {
        const info = durationPrices.get(d.id);
        return {
            slug: d.slug,
            label: d.label || `${d.days}D/${d.nights}N`,
            price: info?.pricePerAdult ? `₹${info.pricePerAdult.toLocaleString("en-IN")}` : "",
            image_url: imgUrl(d.thumbnail_url) || imgUrl(pageData.images[i]?.url) || coverImage,
            isDefault: d.is_default,
            durationId: d.id,
            routeId: info?.routeId ?? null,
        };
    });

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
    // Pre-compute consecutive-run starts for hotels.
    // Same hotel on non-consecutive days (with another hotel in between) gets
    // two separate entries. Only the first day of each run is shown with
    // nights = run length. Key = day number of the run start.
    const hotelRunStart = new Map<number, number>(); // day → nights in run
    for (let i = 0; i < pageData.itinerary.length; i++) {
        const d = pageData.itinerary[i];
        if (!d.hotel) continue;
        const prev = pageData.itinerary[i - 1];
        if (prev?.hotel?.id === d.hotel.id) continue; // continuation — skip
        let nights = 1;
        for (let j = i + 1; j < pageData.itinerary.length; j++) {
            if (pageData.itinerary[j].hotel?.id === d.hotel.id) nights++;
            else break;
        }
        hotelRunStart.set(d.day, nights);
    }

    const itinerary: ItineraryDay[] = pageData.itinerary.map((d, dayIdx) => {
        type SortableSection = DaySection & { _sort: number };

        // Default cab type for this day (from PricingTab cab options)
        const dayCab = getCabForDay(d.day);

        const transferSections: SortableSection[] = d.transfers.map(t => ({
            _sort: t.sort_order,
            type: "cab" as const,
            from: { label: "Pickup", value: t.pickup_name ?? "–", locationType: t.pickup_location_type },
            to: { label: "Drop", value: t.drop_name ?? "–", locationType: t.drop_location_type },
            distance_km: t.distance_km,
            // Prefer per-transfer vehicle; fall back to default cab type for this day
            vehicle_name: t.vehicle_name ?? dayCab?.label ?? null,
            vehicle_type: t.vehicle_type ?? dayCab?.vehicle.type ?? null,
            vehicle_capacity: t.vehicle_capacity ?? dayCab?.vehicle.passenger_capacity ?? null,
            vehicle_image: imgUrl(t.vehicle_image_key) || imgUrl(dayCab?.vehicle.image_key),
            num_vehicles: t.num_vehicles,
            transfer_notes: t.notes,
        }));

        const runNights = d.hotel ? hotelRunStart.get(d.day) : undefined;
        const hotelSections: SortableSection[] = (d.hotel && runNights !== undefined) ? [{
            _sort: d.hotel.sort_order,
            type: "stay" as const,
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
                const hotelPool = d.hotel.images
                    .map(img => imgUrl(img.url)).filter(Boolean) as string[];
                const roomPool = d.hotel.room_images
                    .map(img => imgUrl(img.url)).filter(Boolean) as string[];
                const take = (primary: string[], fallback: string[]) =>
                    primary.shift() ?? fallback.shift();
                const slots: string[] = [];
                // Slot 1: hotel, then room
                const s1 = take(hotelPool, roomPool); if (s1) slots.push(s1);
                // Slots 2–3: room, then hotel
                for (let i = 0; i < 2; i++) { const v = take(roomPool, hotelPool); if (v) slots.push(v); }
                // Slots 4–5: hotel, then room
                for (let i = 0; i < 2; i++) { const v = take(hotelPool, roomPool); if (v) slots.push(v); }
                return slots;
            })(),
        }] : [];

        const activitySections: SortableSection[] = d.activities.map(a => ({
            _sort: a.sort_order,
            type: "activity" as const,
            name: a.name,
            description: a.description,
            duration_hours: a.duration_hours,
            difficulty: a.difficulty,
            category: a.category,
            is_optional: a.is_optional,
            pricingTiers: a.pricingTiers,
            images: a.images.map(img => ({
                src: imgUrl(img.url),
                label: img.label ?? img.alt ?? a.category ?? a.name,
            })),
        }));

        const sections = [...transferSections, ...hotelSections, ...activitySections]
            .sort((a, b) => a._sort - b._sort)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map(({ _sort, ...s }) => s as DaySection);

        // ── Meals — one resolved source per slot, matching the day builder:
        //    breakfast is served by the PREVIOUS night's hotel; lunch/dinner/
        //    snacks by tonight's hotel; activities fill remaining slots (unless
        //    excluded); manual meals last. First source wins (hotel > activity
        //    > manual) so a slot is never shown twice. ──
        const chosen = new Map<string, string | null>(); // slot key → source name (null = manual)

        // Breakfast from the previous night's hotel
        const prevHotel = pageData.itinerary[dayIdx - 1]?.hotel ?? null;
        if (prevHotel) {
            const pm = prevHotel.active_meals.length > 0
                ? prevHotel.active_meals
                : expandMealPlan(prevHotel.meal_type, prevHotel.plan_name);
            if (pm.some((m) => mealKey(m) === "breakfast")) chosen.set("breakfast", prevHotel.name);
        }
        // Non-breakfast meals from tonight's hotel
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
        // Activity-provided meals (respect excluded_meals); hotel wins ties
        const excluded = new Set((d.excluded_meals ?? []).map(mealKey));
        for (const a of d.activities) {
            for (const m of (a.included_meals ?? [])) {
                const k = mealKey(m);
                if (excluded.has(k) || chosen.has(k)) continue;
                chosen.set(k, a.name);
            }
        }
        // Manually-added meals last
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
        <>
            <PackageBookingProvider
                packageId={pageData.id}
                durationId={pageData.currentDuration.id}
                routeId={pageData.selectedRoute!.id}
                stayCategoryId={pageData.selectedStay!.id}
                packageName={pageData.title}
                initialAdults={initialAdults}
                initialChildAges={initialChildAges}
                initialTravelDate={initialTravelDate}
                initialLeavingFrom={initialLeavingFrom}
                cabTypes={pageData.cabTypes}
            >
                <PackageScrollReset slug={slug} />
                <TravelerInputBar />

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
                        enquiry={<EnquiryForm packageName={pageData.title} />}
                        itinerary={
                            <div className="flex flex-col gap-8">
                                <TripDuration
                                    durationOptions={durationOptions}
                                    baseURL={`/packages/${slug}`}
                                    durationSlug={duration}
                                    routeSlug={route}
                                    staySlug={stay}
                                    packageId={pageData.id}
                                    stayCategoryId={startingStayId ?? pageData.selectedStay!.id}
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
                                                                {d.hotel
                                                                    ? (d.hotel.active_meals.length > 0
                                                                        ? d.hotel.active_meals.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')
                                                                        : d.hotel.meal_type ?? d.hotel.plan_name ?? '–')
                                                                    : '–'}
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
                                            policy.type === 'CANCELLATION' ? 'Cancellation Policy'
                                                : policy.type === 'DATE_CHANGE' ? 'Date Change Policy'
                                                    : policy.type === 'REFUND' ? 'Refund Policy'
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
                </div>

                <RelatedPackages
                    currentPackageId={pageData.id}
                    destinationId={pageData.destination_id}
                />
            </PackageBookingProvider>

        </>

    );
}
