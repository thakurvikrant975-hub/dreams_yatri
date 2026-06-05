import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/app/components/navigation/Header';
import Footer from '@/app/components/navigation/Footer';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Heading, Text } from '@/app/components/ui/Typography';
import { db } from '@/app/lib/db';
import { getPackageQuote, checkQuoteFreshness } from '@/app/actions/quote/actions';
import { getPaymentScheduleForQuote } from '@/app/actions/payment/schedule';
import BookReview from './BookReview';
import type { PreviewDay } from './PackagePreview';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Review your booking | Dreams Yatri',
    robots: { index: false, follow: false },
};

function StatusScreen({
    heading,
    body,
    cta,
}: {
    heading: string;
    body: string;
    cta?: { href: string; label: string };
}) {
    return (
        <div className="screen-space py-16">
            <Card className="max-w-lg mx-auto px-8 py-10 text-center">
                <Heading level={3} weight="semibold">{heading}</Heading>
                <Text intent="secondary" className="mt-2 block">{body}</Text>
                <Link href={cta?.href ?? '/packages'} className="inline-block mt-6">
                    <Button variant="premium">{cta?.label ?? 'Browse packages'}</Button>
                </Link>
            </Card>
        </div>
    );
}

export default async function BookQuotePage({
    params,
}: {
    params: Promise<{ quoteId: string }>;
}) {
    const { quoteId } = await params;
    const result = await getPackageQuote(quoteId);

    let content: React.ReactNode;

    if (!result.success) {
        content =
            result.reason === 'invalid' ? (
                <StatusScreen
                    heading="We couldn't verify this quote"
                    body="This booking link looks invalid or has been altered. Please start again from the package page to get a secure price."
                />
            ) : (
                <StatusScreen
                    heading="Quote not found"
                    body="This booking link doesn't exist or may have been removed. Browse our packages to start a new booking."
                />
            );
    } else {
        const quote = result.quote;
        const packageHref = `/packages/${quote.package_slug}/${quote.duration_slug}/${quote.route_slug}/${quote.stay_slug}`;

        // Display info + freshness + payment schedule + frozen itinerary preview.
        const [pkg, freshness, scheduleRes, quoteRow] = await Promise.all([
            db.packages.findUnique({
                where: { slug: quote.package_slug },
                select: { title: true, thumbnail: true },
            }),
            quote.status === 'ACTIVE' ? checkQuoteFreshness(quote.id) : Promise.resolve(null),
            getPaymentScheduleForQuote(quote.id),
            db.package_quote.findUnique({ where: { id: quote.id }, select: { breakdown: true } }),
        ]);
        // The stored breakdown carries internal costs (room/cab/activity prices,
        // margins). Project ONLY display-safe inclusion fields for the browser —
        // never ship pricing/margins to the client. Catalog detail (images,
        // distance, activity duration/category) is fetched live by ID and added.
        type RawDay = {
            day: number; day_title: string;
            hotel?: { hotel_name?: string; room_name?: string | null; plan_name?: string | null; hotel_id?: number; room_id?: number | null } | null;
            meals?: { label: string }[];
            activities?: { id?: number; name: string; is_optional: boolean }[];
            transfers?: { pickup_name?: string | null; drop_name?: string | null; distance_km?: number | null }[];
        };
        const rawDays = ((quoteRow?.breakdown as { days?: RawDay[] } | null)?.days ?? []);

        const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
        const r2 = (k: string | null | undefined): string | null => (k ? (k.startsWith('http') ? k : `${R2}/${k}`) : null);

        const hotelIds = [...new Set(rawDays.map((d) => d.hotel?.hotel_id).filter((x): x is number => !!x))];
        const roomIds = [...new Set(rawDays.map((d) => d.hotel?.room_id).filter((x): x is number => !!x))];
        const activityIds = [...new Set(rawDays.flatMap((d) => (d.activities ?? []).map((a) => a.id).filter((x): x is number => !!x)))];

        const [hotelRows, roomImgRows, actRows, actImgRows] = await Promise.all([
            hotelIds.length ? db.hotels.findMany({ where: { id: { in: hotelIds } }, select: { id: true, thumbnail: true } }) : Promise.resolve([]),
            roomIds.length ? db.hotel_room_images.findMany({ where: { room_id: { in: roomIds } }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], select: { room_id: true, url: true, thumbnail: true } }) : Promise.resolve([]),
            activityIds.length ? db.activities.findMany({ where: { id: { in: activityIds } }, select: { id: true, duration_hours: true, difficulty: true, category: { select: { name: true } } } }) : Promise.resolve([]),
            activityIds.length ? db.activity_images.findMany({ where: { activity_id: { in: activityIds } }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], select: { activity_id: true, url: true, thumbnail: true } }) : Promise.resolve([]),
        ]);

        const hotelThumb = new Map(hotelRows.map((h) => [h.id, h.thumbnail]));
        const roomImg = new Map<number, string | null>();
        for (const r of roomImgRows) if (!roomImg.has(r.room_id)) roomImg.set(r.room_id, r.thumbnail ?? r.url);
        const actMeta = new Map(actRows.map((a) => [a.id, { duration: a.duration_hours != null ? Number(a.duration_hours) : null, difficulty: a.difficulty, category: a.category?.name ?? null }]));
        const actImg = new Map<number, string | null>();
        for (const a of actImgRows) if (!actImg.has(a.activity_id)) actImg.set(a.activity_id, a.thumbnail ?? a.url);

        const itinerary: PreviewDay[] = rawDays.map((d) => ({
            day: d.day,
            day_title: d.day_title,
            hotel: d.hotel
                ? {
                      hotel_name: d.hotel.hotel_name ?? '',
                      room_name: d.hotel.room_name ?? null,
                      plan_name: d.hotel.plan_name ?? null,
                      image: r2(d.hotel.hotel_id ? hotelThumb.get(d.hotel.hotel_id) : null),
                      room_image: r2(d.hotel.room_id ? roomImg.get(d.hotel.room_id) : null),
                  }
                : null,
            meals: (d.meals ?? []).map((m) => ({ label: m.label })),
            activities: (d.activities ?? []).map((a) => {
                const meta = a.id ? actMeta.get(a.id) : null;
                return {
                    name: a.name,
                    is_optional: a.is_optional,
                    duration_hours: meta?.duration ?? null,
                    category: meta?.category ?? null,
                    difficulty: meta?.difficulty ?? null,
                    image: r2(a.id ? actImg.get(a.id) : null),
                };
            }),
            transfers: (d.transfers ?? []).map((t) => ({ pickup_name: t.pickup_name ?? null, drop_name: t.drop_name ?? null, distance_km: t.distance_km ?? null })),
        }));

        const thumbnail = pkg?.thumbnail
            ? (pkg.thumbnail.startsWith('http') ? pkg.thumbnail : `${R2}/${pkg.thumbnail}`)
            : null;

        content = (
            <BookReview
                quote={quote}
                packageTitle={pkg?.title ?? 'Your package'}
                thumbnail={thumbnail}
                packageHref={packageHref}
                drift={freshness ? { fresh: freshness.fresh, currentTotal: freshness.currentTotal } : null}
                schedule={scheduleRes.success ? scheduleRes.schedule : null}
                itinerary={itinerary}
            />
        );
    }

    return (
        <>
            <Header />
            {content}
            <Footer />
        </>
    );
}
