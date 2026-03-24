// app/(website)/package/[slug]/[duration]/page.tsx
import { notFound }              from "next/navigation";
import { packagesRepository }    from "@/app/repositories/packages.repository";
import PackageHero               from "./components/hero";
import PackageTab                from "./components/PackageTab";
import TripDuration              from "./components/inputs/TripDuration";
import DestinationRoutes         from "./components/inputs/DestinationRoutes";
import StayCategory              from "./components/inputs/StayCategory";
import PricingCard               from "./components/SidebarCards/PricingCard";
import CoupenCard                from "./components/SidebarCards/CoupenCard";
import EnquiryForm               from "./components/SidebarCards/EnquiryForm";
import ItinerarySection          from "./components/Itnary";
import type { RouteOption }      from "@/app/types/package-page.types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; duration: string }>;
}) {
  const { slug, duration } = await params;

  const data = await packagesRepository.findPageData(slug, duration);
  if (!data) return {};
  return {
    title:       data.currentDuration.meta_title ?? `${data.title} | Dreams Yatri`,
    description: data.currentDuration.meta_desc  ?? data.description,
  };
}

export default async function PackagePage({
  params,
}: {
  params: Promise<{ slug: string; duration: string }>;
}) {
  const { slug, duration } = await params;

  const data = await packagesRepository.findPageData(slug, duration);
  if (!data) notFound();

 console.log(data);

  // ── Resolve defaults ─────────────────────────────────────────────────────
  const routes       = data.currentDuration.routes as RouteOption[];
  const defaultRoute = routes.find(r => r.is_default) ?? routes[0];
  const defaultStay  = data.stay_categories.find(s => s.is_default)
                    ?? data.stay_categories[0];

  // ── Convert ALL Decimal fields before passing to Client Components ────────
  // Never spread Prisma objects — always explicitly pick and convert

  const pricingForClient = data.currentDuration.pricing.map(p => ({
    route_index:      p.route_index,
    stay_category_id: p.stay_category_id,
    price:            Number(p.price),
    original_price:   p.original_price ? Number(p.original_price) : null,
  }));

  const durationsWithPrice = data.durations.map(d => ({
    id:           d.id,
    slug:         d.slug,
    label:        d.label,
    days:         d.days,
    nights:       d.nights,
    is_default:   d.is_default,
    startingPrice: d.pricing[0]?.price
      ? Number(d.pricing[0].price)
      : null,
    originalPrice: d.pricing[0]?.original_price
      ? Number(d.pricing[0].original_price)
      : null,
  }));

  // ── Default price from converted array ────────────────────────────────────
  const defaultPrice  = pricingForClient.find(
    p => p.route_index === 0 && p.stay_category_id === defaultStay?.id
  );
  const price         = defaultPrice?.price          ?? 0;
  const originalPrice = defaultPrice?.original_price ?? 0;
  const savings       = originalPrice - price;

  // ── Inclusions ────────────────────────────────────────────────────────────
  const inclusions = [
    { key: "transfer",    label: "Transfer"    },
    { key: "stay",        label: "Stay"        },
    { key: "breakfast",   label: "Breakfast"   },
    { key: "sightseeing", label: "Sightseeing" },
  ];

  // ── Route stops for hero ──────────────────────────────────────────────────
  const routeStops = defaultRoute.stops.map((stop, i) => ({
    days:  i === 0 ? data.currentDuration.nights - 1 : 1,
    place: stop,
  }));

  // ── Itinerary — convert hotel images (no Decimals but safe to clean) ──────
  const itineraryForClient = data.currentDuration.itineraries.map(day => ({
    id:           day.id,
    day:          day.day,
    title:        day.title,
    description:  day.description,
    activities:   day.activities   as string[],
    activity_ids: day.activity_ids as number[],
    meals:        day.meals        as string[],
    route_index:  day.route_index,
    hotel: day.hotel ? {
      id:             day.hotel.id,
      name:           day.hotel.name,
      slug:           day.hotel.slug,
      star_rating:    day.hotel.star_rating,
      category:       day.hotel.category,
      check_in_time:  day.hotel.check_in_time,
      check_out_time: day.hotel.check_out_time,
      images:         day.hotel.images,
    } : null,
  }));

  // app/(website)/package/[slug]/[duration]/page.tsx

// ── Map DB itinerary to ItinerarySection component shape ──────────────────────
const mappedItinerary = itineraryForClient.map(day => {
  const sections: any[] = [];

  // ── Stay section — from hotel FK ────────────────────────────────────────
  if (day.hotel) {
    sections.push({
      type:       "stay",
      nights:     1,
      hotelName:  day.hotel.name,
      stars:      day.hotel.star_rating ?? 3,
      checkIn:    day.hotel.check_in_time  ?? "2:00 PM",
      checkOut:   day.hotel.check_out_time ?? "11:00 AM",
      inclusions: [
        { label: "Breakfast", status: "included" },
        { label: "Lunch",     status: "excluded" },
        { label: "Dinner",    status: "included" },
      ],
      images: day.hotel.images.map(img => img.url),
    });
  }

  // ── Activity sections — from activity_ids ────────────────────────────────
  if (day.activities && Array.isArray(day.activities) && day.activities.length > 0) {
    sections.push({
      type:   "activity",
      name:   (day.activities as string[]).join(", "),
      images: [],
    });
  }

  // ── Food section — from meals ────────────────────────────────────────────
  if (day.meals && Array.isArray(day.meals) && (day.meals as string[]).length > 0) {
    const mealMap: Record<string, "breakfast" | "lunch" | "dinner"> = {
      Breakfast: "breakfast",
      Lunch:     "lunch",
      Dinner:    "dinner",
    };

    sections.push({
      type:  "food",
      meals: (day.meals as string[])
        .filter(m => mealMap[m])
        .map(m => ({
          meal:       mealMap[m],
          restaurant: "Included in package",
          items:      "As per package menu",
        })),
    });
  }

  return {
    day:         day.day,
    title:       day.title,
    description: day.description ?? undefined,
    sections,
  };
});

  return (
    <div>

      <PackageHero
        title={data.title}
        duration={`${data.currentDuration.days}D/${data.currentDuration.nights}N`}
        itinerary={routeStops}
        inclusions={inclusions}
        images={data.images.map(img => img.url)}
      />

      <div className="flex gap-10 py-section-sm screen-space">

        <div className="flex-1">
          <PackageTab slug={slug} />

          <div className="py-6 flex flex-col gap-8">

            <TripDuration
              durations={durationsWithPrice}
              currentSlug={duration}
              packageSlug={slug}
            />

            <DestinationRoutes
              routes={routes}
              defaultRouteId={defaultRoute.id}
            />

            <StayCategory
              categories={data.stay_categories}
              defaultId={defaultStay?.id}
              currentDurationDays={data.currentDuration.days}
            />

            <ItinerarySection
              days={mappedItinerary}
            />

          </div>
        </div>

        <aside className="sticky top-(--header-height) w-[27%]">
          <div className="flex flex-col gap-3">
            <PricingCard
              originalPrice={originalPrice}
              discountedPrice={price}
              savings={savings}
              packageName={data.title}
              allPricing={pricingForClient}
              stayCategories={data.stay_categories}
              defaultStayId={defaultStay?.id}
            />
            <CoupenCard
              coupons={[
                { code: "MH45DREAM", discount: 2000, description: "Coupon applied successfully",      applied: true  },
                { code: "TH43MK982", discount: 2000, description: "Get Discount Before it disappear", applied: false },
              ]}
            />
            <EnquiryForm
              discountedPrice={price}
              savings={savings}
              packageName={data.title}
            />
          </div>
        </aside>

      </div>
    </div>
  );
}