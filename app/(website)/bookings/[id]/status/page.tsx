import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/app/components/navigation/Header';
import Footer from '@/app/components/navigation/Footer';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Heading, Text } from '@/app/components/ui/Typography';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import { getBookingFulfillment } from '@/app/services/fulfillment/status.service';
import StatusView from './StatusView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Trip status | Dreams Yatri',
    robots: { index: false, follow: false },
};

function formatDate(d: Date | null): string {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function StatusScreen({ heading, body }: { heading: string; body: string }) {
    return (
        <div className="screen-space py-16">
            <Card className="max-w-lg mx-auto px-8 py-10 text-center">
                <Heading level={3} weight="semibold">{heading}</Heading>
                <Text intent="secondary" className="mt-2 block">{body}</Text>
                <Link href="/packages" className="inline-block mt-6"><Button variant="premium">Browse packages</Button></Link>
            </Card>
        </div>
    );
}

export default async function BookingStatusPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getAuthenticatedUser();

    let content: React.ReactNode;

    if (!user?.id) {
        content = <StatusScreen heading="Please log in" body="Log in to track your trip status." />;
    } else {
        const booking = await db.booking.findUnique({
            where: { id },
            select: {
                id: true, userId: true, bookingNumber: true, startDate: true, endDate: true,
                package: { select: { title: true, thumbnail: true } },
            },
        });

        if (!booking || booking.userId !== user.id) {
            content = <StatusScreen heading="Booking not found" body="This booking doesn't exist or isn't associated with your account." />;
        } else {
            const fulfillment = await getBookingFulfillment(id);
            if (!fulfillment) {
                content = <StatusScreen heading="Status unavailable" body="We couldn't load the status for this booking. Please try again." />;
            } else {
                const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
                const thumb = booking.package?.thumbnail
                    ? (booking.package.thumbnail.startsWith('http') ? booking.package.thumbnail : `${R2}/${booking.package.thumbnail}`)
                    : null;

                content = (
                    <StatusView
                        packageTitle={booking.package?.title ?? 'Your package'}
                        thumbnail={thumb}
                        dateRange={`${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`}
                        bookingNumber={booking.bookingNumber}
                        payHref={`/bookings/${booking.id}/pay`}
                        fulfillment={fulfillment}
                    />
                );
            }
        }
    }

    return (
        <>
            <Header />
            {content}
            <Footer />
        </>
    );
}
