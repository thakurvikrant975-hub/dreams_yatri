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

        // Display info + freshness + payment schedule (skip recompute for expired quotes).
        const [pkg, freshness, scheduleRes] = await Promise.all([
            db.packages.findUnique({
                where: { slug: quote.package_slug },
                select: { title: true, thumbnail: true },
            }),
            quote.status === 'ACTIVE' ? checkQuoteFreshness(quote.id) : Promise.resolve(null),
            getPaymentScheduleForQuote(quote.id),
        ]);

        const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
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
