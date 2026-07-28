import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Header from '@/app/components/navigation/Header';
import Footer from '@/app/components/navigation/Footer';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Heading, Text } from '@/app/components/ui/Typography';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import { enabledGateways } from '@/app/lib/payments/registry';
import PaymentStep from './PaymentStep';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Payment | Dreams Yatri',
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

export default async function BookingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getAuthenticatedUser();

    let content: React.ReactNode;

    if (!user?.id) {
        content = <StatusScreen heading="Please log in" body="Log in to continue your payment." />;
    } else {
        const booking = await db.booking.findUnique({
            where: { id },
            select: {
                id: true, userId: true, bookingNumber: true, status: true, paymentStatus: true, paymentPlan: true,
                startDate: true, endDate: true, travellers: true, contactEmail: true, contactPhone: true,
                totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
                packageId: true,
                package: { select: { title: true, thumbnail: true } },
                hotelBookings: { take: 1, select: { hotel: { select: { name: true, thumbnail: true } } } },
            },
        });

        if (!booking || booking.userId !== user.id) {
            content = <StatusScreen heading="Booking not found" body="This booking doesn't exist or isn't associated with your account." />;
        } else if (booking.status === 'CANCELLED') {
            content = <StatusScreen heading="Booking cancelled" body="This booking has been cancelled and can no longer be paid." />;
        } else {
            const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
            const isHotelOnly = booking.packageId == null;
            const hotel = booking.hotelBookings[0]?.hotel;
            const title = isHotelOnly ? (hotel?.name ?? 'Your stay') : (booking.package?.title ?? 'Your package');
            const rawThumb = isHotelOnly ? hotel?.thumbnail : booking.package?.thumbnail;
            const thumb = rawThumb ? (rawThumb.startsWith('http') ? rawThumb : `${R2}/${rawThumb}`) : null;

            if (booking.paymentStatus !== 'PENDING') {
                // Already settled the initial leg — only payable now if a hotel/room
                // change left an outstanding balance (pay-the-extra flow).
                if (booking.balanceAmount_paise > 0) {
                    content = (
                        <PaymentStep
                            bookingId={booking.id}
                            bookingNumber={booking.bookingNumber}
                            packageTitle={title}
                            thumbnail={thumb}
                            dateRange={`${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`}
                            travellers={booking.travellers}
                            contactEmail={booking.contactEmail}
                            contactPhone={booking.contactPhone}
                            plan={booking.paymentPlan === 'FULL' ? 'FULL' : 'DEPOSIT'}
                            mode="BALANCE"
                            payNowPaise={booking.balanceAmount_paise}
                            totalPaise={booking.totalAmount_paise}
                            balancePaise={0}
                            balanceDueDate={null}
                            gateways={enabledGateways()}
                        />
                    );
                } else {
                    // Fully settled → straight to the confirmation page.
                    redirect(`/bookings/${booking.id}`);
                }
            } else {
                // The latest initial-leg attempt: gives us the amount due and whether the
                // last try failed (so we can show a "try again" hint). A failed attempt
                // still leaves the booking payable — startBookingPayment opens a fresh leg.
                const lastInit = await db.payment.findFirst({
                    where: { bookingId: booking.id, purpose: 'INITIAL' },
                    orderBy: { createdAt: 'desc' },
                    select: { status: true, amount_paise: true },
                });
                const payNowPaise = lastInit?.amount_paise ?? booking.advanceAmount_paise;
                const retry = lastInit?.status === 'FAILED';
                const isFull = booking.paymentPlan === 'FULL';

                content = (
                    <PaymentStep
                        bookingId={booking.id}
                        bookingNumber={booking.bookingNumber}
                        packageTitle={title}
                        thumbnail={thumb}
                        dateRange={`${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`}
                        travellers={booking.travellers}
                        contactEmail={booking.contactEmail}
                        contactPhone={booking.contactPhone}
                        plan={isFull ? 'FULL' : 'DEPOSIT'}
                        payNowPaise={payNowPaise}
                        totalPaise={booking.totalAmount_paise}
                        balancePaise={isFull ? 0 : booking.balanceAmount_paise}
                        balanceDueDate={isFull ? null : formatDate(booking.balanceDueDate)}
                        gateways={enabledGateways()}
                        retry={retry}
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
