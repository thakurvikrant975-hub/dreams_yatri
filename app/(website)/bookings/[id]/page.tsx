import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircleIcon, CompassIcon } from '@phosphor-icons/react/dist/ssr';
import Header from '@/app/components/navigation/Header';
import Footer from '@/app/components/navigation/Footer';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Heading, Text } from '@/app/components/ui/Typography';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import { isPaidStatus } from '@/app/lib/messaging';
import InvoiceDocument from '@/app/components/invoice/InvoiceDocument';
import { INVOICE_BOOKING_SELECT } from '@/app/lib/invoice';
import StatusPoller from './StatusPoller';
import DownloadReceiptButton from './DownloadReceiptButton';
import GuestChatThread from './GuestChatThread';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Booking confirmation | Dreams Yatri',
    robots: { index: false, follow: false },
};

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
        // Spread INVOICE_BOOKING_SELECT rather than listing the fields again: the
        // hand-written select here omitted `hotelBookings`, and since that field
        // is optional on InvoiceBookingData it failed silently — every direct
        // hotel booking's confirmation showed a "Holiday Tour Package" invoice
        // priced at the package GST rate.
        const booking = await db.booking.findUnique({
            where: { id },
            select: {
                id: true, userId: true, status: true, paymentStatus: true,
                ...INVOICE_BOOKING_SELECT,
            },
        });

        if (!booking || booking.userId !== user.id) {
            content = <StatusScreen heading="Booking not found" body="This booking doesn't exist or isn't associated with your account." />;
        } else {
            const pending = booking.paymentStatus === 'PENDING';
            const cancelled = booking.status === 'CANCELLED';

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
                    <Card className={confirming || cancelled || paymentFailed ? 'max-w-xl mx-auto px-8 py-9' : 'max-w-4xl mx-auto px-8 py-9'}>
                        {cancelled ? (
                            <div className="text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-600 text-2xl">✕</div>
                                <Heading level={3} weight="semibold">Booking cancelled</Heading>
                                <Text intent="secondary" className="mt-1 block">
                                    Booking <span className="font-medium text-primary">{booking.bookingNumber}</span> has been cancelled.
                                    Any eligible refund is being processed back to your original payment method.
                                </Text>
                                <Link href="/packages" className="inline-block mt-5">
                                    <Button variant="outline">Explore more packages</Button>
                                </Link>
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
                            <div className="text-center">
                                <Heading level={3} weight="semibold">Confirming your payment…</Heading>
                                <Text intent="secondary" className="mt-2 block">
                                    We're confirming your payment with the bank. This page updates automatically —
                                    it usually takes only a few moments.
                                </Text>
                            </div>
                        ) : (
                            <>
                                <div className="text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-100 text-success-600">
                                        <CheckCircleIcon weight="fill" className="size-9" />
                                    </div>
                                    <Heading level={2} weight="bold">Booking confirmed!</Heading>
                                    <Text intent="secondary" className="mt-2 block">
                                        Booking <span className="font-semibold text-primary">{booking.bookingNumber}</span> is confirmed —
                                        we've sent the details to your email.
                                    </Text>
                                </div>

                                <div className="mt-7 -mx-8 sm:mx-0">
                                    <InvoiceDocument booking={booking} />
                                </div>

                                <div className="mt-4 flex justify-center gap-4 text-sm">
                                    <Link href={`/bookings/${booking.id}/voucher`} className="text-primary font-medium underline">Trip voucher</Link>
                                </div>

                                {isPaidStatus(booking.paymentStatus) && (
                                    <div id="chat" className="mt-4 scroll-mt-20">
                                        <GuestChatThread bookingId={booking.id} />
                                    </div>
                                )}

                                <div className="mt-7 flex flex-col gap-3">
                                    <Link href={`/bookings/${booking.id}/status`} className="block">
                                        <Button variant="premium" size="lg" className="w-full">
                                            <CompassIcon weight="bold" className="size-4" />
                                            View package status
                                        </Button>
                                    </Link>
                                    <DownloadReceiptButton bookingId={booking.id} />
                                </div>
                            </>
                        )}
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
