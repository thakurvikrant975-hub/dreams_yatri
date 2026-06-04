import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/app/components/navigation/Header';
import Footer from '@/app/components/navigation/Footer';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Heading, Text } from '@/app/components/ui/Typography';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import { formatPaise } from '@/app/lib/money';
import StatusPoller from './StatusPoller';
import CancelBookingPanel from './CancelBookingPanel';
import ChangeDatePanel from './ChangeDatePanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Booking confirmation | Dreams Yatri',
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

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getAuthenticatedUser();

    let content: React.ReactNode;

    if (!user?.id) {
        content = <StatusScreen heading="Please log in" body="Log in to view this booking confirmation." />;
    } else {
        const booking = await db.booking.findUnique({
            where: { id },
            select: {
                id: true, userId: true, bookingNumber: true, status: true, paymentStatus: true, paymentPlan: true,
                startDate: true, endDate: true, travellers: true,
                totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
                package: { select: { title: true } },
            },
        });

        if (!booking || booking.userId !== user.id) {
            content = <StatusScreen heading="Booking not found" body="This booking doesn't exist or isn't associated with your account." />;
        } else {
            const pending = booking.paymentStatus === 'PENDING';
            const cancelled = booking.status === 'CANCELLED';
            const isFull = booking.paymentPlan === 'FULL';
            const paidPaise = isFull ? booking.totalAmount_paise : booking.advanceAmount_paise;

            // If still pending, is there an in-flight charge (PENDING payment) or did
            // the last attempt fail? A failed attempt → offer a retry instead of
            // polling forever for a confirmation that will never come.
            let paymentFailed = false;
            if (pending && !cancelled) {
                const lastInit = await db.payment.findFirst({
                    where: { bookingId: booking.id, purpose: 'INITIAL' },
                    orderBy: { createdAt: 'desc' },
                    select: { status: true },
                });
                paymentFailed = !lastInit || lastInit.status === 'FAILED';
            }
            const confirming = pending && !cancelled && !paymentFailed;

            content = (
                <div className="screen-space py-10">
                    {confirming && <StatusPoller />}
                    <Card className="max-w-xl mx-auto px-8 py-9">
                        {cancelled ? (
                            <div className="text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-600 text-2xl">✕</div>
                                <Heading level={3} weight="semibold">Booking cancelled</Heading>
                                <Text intent="secondary" className="mt-1 block">
                                    Booking <span className="font-medium text-primary">{booking.bookingNumber}</span> has been cancelled.
                                    Any eligible refund is being processed back to your original payment method.
                                </Text>
                            </div>
                        ) : paymentFailed ? (
                            <div className="text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-600 text-2xl">!</div>
                                <Heading level={3} weight="semibold">Payment not completed</Heading>
                                <Text intent="secondary" className="mt-1 block">
                                    We couldn't confirm a payment for booking <span className="font-medium text-primary">{booking.bookingNumber}</span>.
                                    No money was taken. You can try again — your booking is held for now.
                                </Text>
                                <Link href={`/bookings/${booking.id}/pay`} className="inline-block mt-5">
                                    <Button variant="premium">Try payment again</Button>
                                </Link>
                            </div>
                        ) : confirming ? (
                            <>
                                <div className="text-center">
                                    <Heading level={3} weight="semibold">Confirming your payment…</Heading>
                                    <Text intent="secondary" className="mt-2 block">
                                        We're confirming your payment with the bank. This page updates automatically —
                                        it usually takes only a few moments.
                                    </Text>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center">
                                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-100 text-success-700 text-2xl">✓</div>
                                    <Heading level={3} weight="semibold">Booking confirmed!</Heading>
                                    <Text intent="secondary" className="mt-1 block">
                                        Booking <span className="font-medium text-primary">{booking.bookingNumber}</span>
                                    </Text>
                                </div>

                                <div className="mt-6 rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                                    <Row label="Package" value={booking.package?.title ?? 'Your package'} />
                                    <Row label="Travel dates" value={`${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`} />
                                    <Row label="Travellers" value={String(booking.travellers)} />
                                    <Row label={isFull ? 'Paid in full' : 'Deposit paid'} value={formatPaise(paidPaise)} />
                                    {!isFull && (
                                        <Row
                                            label="Balance due"
                                            value={`${formatPaise(booking.balanceAmount_paise)}${booking.balanceDueDate ? ` by ${formatDate(booking.balanceDueDate)}` : ''}`}
                                        />
                                    )}
                                </div>

                                <Text size="sm" intent="secondary" className="mt-5 block text-center">
                                    A confirmation has been recorded. Our team will reach out with your trip details.
                                </Text>

                                <div className="mt-4 flex justify-center gap-4 text-sm">
                                    <Link href={`/bookings/${booking.id}/invoice`} className="text-primary font-medium underline">Invoice</Link>
                                    <Link href={`/bookings/${booking.id}/voucher`} className="text-primary font-medium underline">Trip voucher</Link>
                                </div>

                                <ChangeDatePanel bookingId={booking.id} />
                                <CancelBookingPanel bookingId={booking.id} />
                            </>
                        )}

                        <div className="mt-6 text-center">
                            <Link href="/packages"><Button variant="outline">Explore more packages</Button></Link>
                        </div>
                    </Card>
                </div>
            );
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

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between px-4 py-3">
            <Text size="sm" intent="secondary">{label}</Text>
            <Text size="sm" weight="medium" intent="primary">{value}</Text>
        </div>
    );
}
