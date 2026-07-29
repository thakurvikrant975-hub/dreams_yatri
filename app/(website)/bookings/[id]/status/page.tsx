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
import { rupeesToPaise } from '@/app/lib/money';
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
                paymentStatus: true, paymentPlan: true, travellers: true,
                totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
                priceSnapshot: true,
                payments: { where: { status: 'FULLY_PAID' }, select: { amount_paise: true } },
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

                const snap = (booking.priceSnapshot ?? {}) as {
                    hotel_subtotal?: number; meal_subtotal?: number; cab_subtotal?: number;
                    gst_amount?: number; gst_percentage?: number; final_price?: number;
                };

                // Ground truth for "how much have I actually paid" — the sum of
                // captured payments, never assumed from the (possibly
                // since-adjusted, e.g. after a hotel/room swap) current total.
                // This is what makes the payment progress bar correct even when
                // ops changes the price after the customer already paid.
                const totalPaise = Number(booking.totalAmount_paise);
                const paidPaise = booking.payments.reduce((s, p) => s + p.amount_paise, 0);

                // The itinerary snapshot freezes the ORIGINAL quoted total —
                // comparing it to the current total surfaces any post-booking
                // price adjustment (hotel/room changes) directly to the customer.
                const originalTotalPaise = snap.final_price != null ? rupeesToPaise(snap.final_price) : totalPaise;
                const priceDeltaPaise = totalPaise - originalTotalPaise;

                // Positive = still owed; negative = overpaid (refund due); zero = settled.
                const amountDuePaise = totalPaise - paidPaise;

                content = (
                    <StatusView
                        packageTitle={booking.package?.title ?? 'Your package'}
                        thumbnail={thumb}
                        dateRange={`${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`}
                        bookingNumber={booking.bookingNumber}
                        payHref={`/bookings/${booking.id}/pay`}
                        fulfillment={fulfillment}
                        payment={{
                            status: booking.paymentStatus,
                            totalPaise,
                            originalTotalPaise,
                            priceDeltaPaise,
                            paidPaise,
                            amountDuePaise,
                            balanceDueDate: booking.balanceDueDate ? formatDate(booking.balanceDueDate) : null,
                            travellers: booking.travellers,
                            hotelCost: snap.hotel_subtotal ?? null,
                            mealCost: snap.meal_subtotal ?? null,
                            cabCost: snap.cab_subtotal ?? null,
                            gstAmount: snap.gst_amount ?? null,
                            gstPct: snap.gst_percentage ?? null,
                        }}
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
