'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useModal } from '@/app/hooks/useModals';
import Link from 'next/link';
import Image from 'next/image';
import QuoteCountdown from './QuoteCountdown';
import CheckoutForm from './CheckoutForm';
import { type PreviewDay } from './PackagePreview';
import type { CheckoutInput } from '@/app/actions/quote/checkout-schema';
import { createBookingDraft } from '@/app/actions/payment/booking.actions';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { formatPaise } from '@/app/lib/money';
import type { SafeQuote } from '@/app/actions/quote/create-quote.service';
import type { PaymentScheduleDTO } from '@/app/actions/payment/types';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function addDaysISO(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}
function formatDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
function shortDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).format(d);
}

function travellersLabel(adults: number, children: number, infants: number): string {
    const parts = [`${adults} Adult${adults !== 1 ? 's' : ''}`];
    if (children > 0) parts.push(`${children} Child${children !== 1 ? 'ren' : ''}`);
    if (infants > 0) parts.push(`${infants} Infant${infants !== 1 ? 's' : ''}`);
    return parts.join(', ');
}

const SECTIONS = [
    { id: 'sec-travellers', label: 'Traveller Details' },
    { id: 'sec-itinerary', label: 'Package Itinerary & Inclusions' },
    { id: 'sec-policy', label: 'Cancellation & Date Change' },
];

export default function BookReview({
    quote,
    packageTitle,
    thumbnail,
    packageHref,
    drift,
    schedule,
    itinerary = [],
}: {
    quote: SafeQuote;
    packageTitle: string;
    thumbnail: string | null;
    packageHref: string;
    drift: { fresh: boolean; currentTotal: number | null } | null;
    schedule: PaymentScheduleDTO | null;
    itinerary?: PreviewDay[];
}) {
    const router = useRouter();
    const { status } = useSession();
    const { openModal } = useModal();
    const [expired, setExpired] = useState(quote.status !== 'ACTIVE');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkout, setCheckout] = useState<CheckoutInput | null>(null);
    const [policy, setPolicy] = useState(false);

    // Phone OTP verification before payment
    const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
    const [otpOpen, setOtpOpen]         = useState(false);
    const [otpDigits, setOtpDigits]     = useState<string[]>(['', '', '', '', '', '']);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpSending, setOtpSending]   = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [otpError, setOtpError]       = useState('');
    const otpRefs         = useRef<(HTMLInputElement | null)[]>([]);
    const widgetReady     = useRef(false);
    const onVerifySuccess = useRef<((data: any) => void) | null>(null);
    const onVerifyFailure = useRef<((err: any)  => void) | null>(null);

    const totalPax = quote.adults + quote.children + quote.infants;
    const priceChanged = drift && !drift.fresh && drift.currentTotal !== null;
    const depositAllowed = schedule?.plan === 'DEPOSIT';
    const [payChoice, setPayChoice] = useState<'DEPOSIT' | 'FULL'>('DEPOSIT');
    const effectiveChoice: 'DEPOSIT' | 'FULL' = depositAllowed ? payChoice : 'FULL';
    const payAmountPaise = schedule ? (effectiveChoice === 'FULL' ? schedule.totalPaise : schedule.depositPaise) : 0;

    const canProceed = Boolean(schedule && checkout && policy && !submitting);

    // Derived trip facts for the header / fare breakup
    const days = itinerary.length;
    const endISO = days > 0 ? addDaysISO(quote.travel_date, days - 1) : quote.travel_date;
    const fromCity = itinerary[0]?.transfers?.[0]?.pickup_name ?? null;
    const hotelsCount = itinerary.filter((d) => d.hotel).length;
    const transfersCount = itinerary.reduce((s, d) => s + (d.transfers?.length ?? 0), 0);
    const activitiesCount = itinerary.reduce((s, d) => s + (d.activities?.length ?? 0), 0);
    const baseAmount = Math.max(0, quote.total_amount - quote.gst_amount);

    // ── MSG91 widget helpers ──────────────────────────────────────────────────
    function initWidget(onReady: () => void) {
        function setup() {
            if (typeof (window as any).initSendOTP !== 'function') return;
            (window as any).initSendOTP({
                widgetId:      process.env.NEXT_PUBLIC_MSG91_WIDGET_ID!,
                tokenAuth:     process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH!,
                exposeMethods: true,
                success: (data: any) => onVerifySuccess.current?.(data),
                failure: (err: any)  => onVerifyFailure.current?.(err),
            });
            widgetReady.current = true;
            onReady();
        }
        if (typeof (window as any).initSendOTP === 'function') { setup(); return; }
        if (document.getElementById('msg91-otp-provider')) {
            const poll = setInterval(() => {
                if (typeof (window as any).initSendOTP === 'function') { clearInterval(poll); setup(); }
            }, 100);
            return;
        }
        const urls = ['https://verify.msg91.com/otp-provider.js', 'https://verify.phone91.com/otp-provider.js'];
        let i = 0;
        function attempt() {
            const script = document.createElement('script');
            script.id = 'msg91-otp-provider'; script.src = urls[i]; script.async = true;
            script.onload = setup;
            script.onerror = () => { script.remove(); i++; if (i < urls.length) attempt(); };
            document.head.appendChild(script);
        }
        attempt();
    }

    function openOtpDialog() {
        if (!checkout) return;
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError('');
        setOtpSending(true);
        initWidget(() => {
            const win = window as any;
            if (!win.sendOtp) { setOtpError('OTP service not ready. Please refresh.'); setOtpSending(false); return; }
            // strip the leading + for MSG91
            win.sendOtp(checkout.contact.phone.replace('+', ''));
            setResendTimer(30);
            setOtpSending(false);
            setOtpOpen(true);
        });
    }

    function handleResend() {
        if (!checkout) return;
        const win = window as any;
        if (!win.sendOtp) { setOtpError('OTP service not ready. Please refresh.'); return; }
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError('');
        win.sendOtp(checkout.contact.phone.replace('+', ''));
        setResendTimer(30);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }

    async function proceedToPayment() {
        setSubmitting(true);
        try {
            const res = await createBookingDraft(quote.id, { paymentChoice: effectiveChoice, details: checkout! });
            if (!res.success) {
                setSubmitting(false);
                if (res.reason === 'unauthenticated') {
                    openModal('login-modal', { redirectTo: window.location.pathname + window.location.search });
                    return;
                }
                setError(
                    res.reason === 'stale' ? 'The price changed since this quote was created. Please refresh for the latest price.'
                    : res.reason === 'not_active' ? 'This quote has expired. Please start again.'
                    : res.message ?? 'Could not continue to payment. Please try again.',
                );
                return;
            }
            router.push(`/bookings/${res.bookingId}/pay`);
        } catch (err) {
            console.error('[BookReview] proceed failed', err);
            setSubmitting(false);
            setError('Something went wrong. Please try again.');
        }
    }

    async function handleProceed() {
        setError(null);
        if (!checkout) { setError('Please complete all traveller and contact details.'); return; }
        if (!policy) { setError('Please accept the booking policies to continue.'); return; }

        // Step 1: must be logged in
        if (status === 'unauthenticated') {
            openModal('login-modal', { redirectTo: window.location.pathname + window.location.search });
            return;
        }

        // Step 2: must verify phone via OTP
        if (checkout.contact.phone !== verifiedPhone) {
            openOtpDialog();
            return;
        }

        // Step 3: create booking
        await proceedToPayment();
    }

    function handleOtpChange(index: number, value: string) {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...otpDigits]; next[index] = digit; setOtpDigits(next);
        if (otpError) setOtpError('');
        if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    }

    function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace') {
            if (otpDigits[index]) { const n = [...otpDigits]; n[index] = ''; setOtpDigits(n); }
            else if (index > 0) otpRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowLeft'  && index > 0) otpRefs.current[index - 1]?.focus();
          else if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
    }

    function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!paste) return;
        const n = [...otpDigits];
        for (let i = 0; i < paste.length; i++) n[i] = paste[i];
        setOtpDigits(n);
        otpRefs.current[Math.min(paste.length, 5)]?.focus();
        if (otpError) setOtpError('');
    }

    function handleVerifyOtp() {
        const otp = otpDigits.join('');
        if (otp.length !== 6) { setOtpError('Enter the 6-digit OTP.'); return; }
        const win = window as any;
        if (!win.verifyOtp) { setOtpError('OTP service not ready. Please refresh.'); return; }
        setOtpVerifying(true);
        setOtpError('');
        onVerifySuccess.current = async () => {
            setVerifiedPhone(checkout!.contact.phone);
            setOtpOpen(false);
            setOtpVerifying(false);
            await proceedToPayment();
        };
        onVerifyFailure.current = (err: any) => {
            setOtpError(err?.message ?? 'Invalid OTP. Please try again.');
            setOtpVerifying(false);
        };
        win.verifyOtp(otp);
    }

    // Resend countdown tick — must be useEffect, not useState
    // (useState is misuse here; useEffect runs the side-effect correctly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (resendTimer <= 0) return;
        const id = setTimeout(() => setResendTimer(t => t - 1), 1000);
        return () => clearTimeout(id);
    }, [resendTimer]);

    if (expired) {
        return (
            <div className="screen-space py-16">
                <Card className="max-w-lg mx-auto px-8 py-10 text-center">
                    <Heading level={3} weight="semibold">This quote has expired</Heading>
                    <Text intent="secondary" className="mt-2 block">
                        Prices are held for a short time to keep them accurate. Please start again to
                        get a fresh price for this package.
                    </Text>
                    <Link href={packageHref} className="inline-block mt-6">
                        <Button variant="premium">Get a fresh price</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <>
        <div className="bg-neutral-100 min-h-screen pb-16">
            {/* ── Dark "Review package" bar with step anchors ───────────────────── */}
            <div className="bg-surface-inverse text-white">
                <div className="screen-space flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <span className="text-base font-medium">Review Package</span>
                    <nav className="flex flex-wrap items-center gap-x-6 gap-y-1">
                        {SECTIONS.map((s, i) => (
                            <a key={s.id} href={`#${s.id}`} className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-white transition-colors">
                                {i + 1}. {s.label}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="screen-space pt-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
                    {/* ── LEFT column ──────────────────────────────────────────────── */}
                    <div className="flex flex-col gap-4">
                        {/* Package header */}
                        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                            <div className="flex gap-4 p-5">
                                {thumbnail && (
                                    <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                        <Image src={thumbnail} alt={packageTitle} fill className="object-cover" sizes="144px" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <Heading level={3} weight="semibold" className="truncate">{packageTitle}</Heading>
                                        <span className="shrink-0 rounded-md border border-primary-200 px-2 py-0.5 text-[11px] font-semibold text-primary-700">Customizable</span>
                                    </div>
                                    <Text size="sm" intent="secondary" className="block mt-1">{quote.duration_label} · {quote.stay_category_label}</Text>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--text-primary)">
                                        <span className="font-semibold">{formatDate(quote.travel_date)}</span>
                                        <span className="text-(--text-muted)">→</span>
                                        <span className="font-semibold">{formatDate(endISO)}</span>
                                        {fromCity && <span className="text-(--text-secondary)">/ From {fromCity}</span>}
                                        <span className="text-(--text-muted)">·</span>
                                        <span className="text-(--text-secondary)">{travellersLabel(quote.adults, quote.children, quote.infants)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 1 · Traveller Details */}
                        <Section id="sec-travellers" n={1} title="Traveller Details">
                            <CheckoutForm pax={{ adults: quote.adults, children: quote.children, infants: quote.infants }} onChange={setCheckout} />
                        </Section>

                        {/* 2 · Package Itinerary & Inclusions */}
                        <Section id="sec-itinerary" n={2} title="Package Itinerary & Inclusions">
                            {itinerary.length > 0 ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm mb-4">
                                        <span className="font-semibold text-(--text-primary)">Package Features</span>
                                        <span className="text-(--text-muted)">/</span>
                                        <Feature n={hotelsCount} label="Hotels" />
                                        <span className="text-(--text-muted)">/</span>
                                        <Feature n={transfersCount} label="Transfers" />
                                        <span className="text-(--text-muted)">/</span>
                                        <Feature n={activitiesCount} label="Activities" />
                                    </div>
                                    <ol className="flex flex-col gap-3">
                                        {itinerary.map((d) => (
                                            <DayBlock key={d.day} day={d} dateISO={addDaysISO(quote.travel_date, d.day - 1)} />
                                        ))}
                                    </ol>
                                </>
                            ) : (
                                <Text size="sm" intent="secondary">Your full day-by-day itinerary will be shared with your confirmation.</Text>
                            )}
                        </Section>

                        {/* 3 · Cancellation & Date Change */}
                        <Section id="sec-policy" n={3} title="Cancellation & Date Change">
                            <div className="flex flex-col gap-3 text-sm">
                                <div>
                                    <Text size="sm" weight="semibold" intent="primary" className="block">Package Cancellation Policy</Text>
                                    <Text size="sm" intent="secondary" className="block mt-0.5">
                                        Free-look and refunds follow our{' '}
                                        <Link href="/cancellation-policy" target="_blank" className="text-primary-600 underline">cancellation policy</Link>
                                        {' '}— the closer to travel, the lower the refund.
                                    </Text>
                                </div>
                                <div>
                                    <Text size="sm" weight="semibold" intent="primary" className="block">Package Date Change Policy</Text>
                                    <Text size="sm" intent="secondary" className="block mt-0.5">
                                        Date changes are subject to availability, re-pricing for the new dates, and a date-change fee.
                                    </Text>
                                </div>
                            </div>
                        </Section>
                    </div>

                    {/* ── RIGHT rail ───────────────────────────────────────────────── */}
                    <aside className="lg:sticky lg:top-4 flex flex-col gap-4">
                        {priceChanged && (
                            <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3" role="alert">
                                <Text size="xs" weight="bold" className="text-primary-700 uppercase tracking-wide block">Updated</Text>
                                <Text size="xs" intent="secondary" className="mt-0.5 block">
                                    The price for this package has changed. Current price {fmt(drift!.currentTotal!)}.{' '}
                                    <Link href={packageHref} className="underline font-medium text-primary-700">Get a fresh price</Link>.
                                </Text>
                            </div>
                        )}

                        {/* Grand total + fare breakup */}
                        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-(--border-muted)">
                                <div className="flex items-center justify-between">
                                    <Text size="xs" intent="muted" weight="semibold" className="uppercase tracking-wide">Grand Total · {totalPax} traveller{totalPax !== 1 ? 's' : ''}</Text>
                                </div>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-(--text-primary) font-heading">{fmt(quote.total_amount)}</span>
                                    <span className="text-xs text-(--text-muted)">(incl. GST)</span>
                                </div>
                                <Text size="sm" weight="semibold" className="text-primary-700 block mt-1">
                                    {effectiveChoice === 'FULL' ? 'Pay Full Amount Now' : `Pay ${formatPaise(payAmountPaise)} now to reserve`}
                                </Text>
                            </div>

                            {/* Fare Breakup */}
                            <div className="px-5 py-4 border-b border-(--border-muted)">
                                <Text size="sm" weight="semibold" intent="primary" className="block mb-2.5">Fare Breakup</Text>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <Text size="sm" intent="secondary" className="block">Total Basic Cost</Text>
                                        <Text size="xs" intent="muted" className="block">{fmt(quote.price_per_adult)} × {totalPax} traveller{totalPax !== 1 ? 's' : ''}</Text>
                                    </div>
                                    <Text size="sm" weight="medium" intent="primary">{fmt(baseAmount)}</Text>
                                </div>
                                <div className="flex items-start justify-between mt-2">
                                    <div>
                                        <Text size="sm" intent="secondary" className="block">Fees &amp; Taxes</Text>
                                        <Text size="xs" intent="muted" className="block">GST {quote.gst_percentage}%</Text>
                                    </div>
                                    <Text size="sm" weight="medium" intent="secondary">+ {fmt(quote.gst_amount)}</Text>
                                </div>
                            </div>

                            {/* Pay plan choice */}
                            {schedule && depositAllowed && (
                                <div className="px-5 py-4 border-b border-(--border-muted) flex flex-col gap-2.5">
                                    <PayOption
                                        selected={payChoice === 'DEPOSIT'} onSelect={() => setPayChoice('DEPOSIT')}
                                        title="Book Now, Pay Later" amount={formatPaise(schedule.depositPaise)}
                                        sub={`Balance ${formatPaise(schedule.balancePaise)}${schedule.balanceDueDate ? ` by ${formatDate(schedule.balanceDueDate)}` : ''}`}
                                    />
                                    <PayOption
                                        selected={payChoice === 'FULL'} onSelect={() => setPayChoice('FULL')}
                                        title="Pay Full Amount Now" amount={formatPaise(schedule.totalPaise)}
                                        sub="Nothing left to pay later."
                                    />
                                </div>
                            )}

                            {/* Important Information + policy */}
                            <div className="px-5 py-4">
                                <Text size="sm" weight="semibold" intent="primary" className="block mb-2">Important Information</Text>
                                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)} className="mt-0.5 size-4 cursor-pointer shrink-0 accent-primary-600" />
                                    <Text size="xs" intent="secondary">
                                        I confirm I have read and accept the{' '}
                                        <Link href="/cancellation-policy" target="_blank" className="text-primary-600 underline">Cancellation Policy</Link>,{' '}
                                        <Link href="/terms" target="_blank" className="text-primary-600 underline">Terms of Service</Link>{' '}and{' '}
                                        <Link href="/privacy-policy" target="_blank" className="text-primary-600 underline">Privacy Policy</Link>.
                                    </Text>
                                </label>

                                <Button variant="premium" size="lg" className="w-full mt-4" onClick={handleProceed} loading={submitting} disabled={!canProceed}>
                                    {!schedule ? 'Unavailable' : !checkout ? 'Complete Traveller Details' : !policy ? 'Accept Policies to Continue' : 'Proceed to Payments'}
                                </Button>

                                {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}
                            </div>
                        </div>

                        {/* Countdown */}
                        <div className="rounded-xl bg-white shadow-sm px-5 py-3.5 flex items-center justify-between gap-3">
                            <div>
                                <Text size="sm" weight="semibold" intent="primary" className="block">Complete booking in</Text>
                                <Text size="xs" intent="muted" className="block">The package price will refresh after that</Text>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                                <QuoteCountdown expiresAt={quote.expires_at} onExpire={() => setExpired(true)} />
                            </span>
                        </div>
                    </aside>
                </div>
            </div>
        </div>

        {/* ── Phone OTP verification dialog ─────────────────────────────── */}
        <Dialog open={otpOpen} onClose={() => setOtpOpen(false)} className="relative z-[500]">
            <DialogBackdrop transition
                className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200" />
            <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <DialogPanel transition
                    className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden
                        data-closed:translate-y-8 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 transition-all">

                    <div className="px-6 pt-7 pb-5 bg-linear-to-br from-primary-600 via-primary-500 to-primary-400">
                        <h2 className="text-xl font-bold text-white">Confirm your number</h2>
                        <p className="text-white/70 text-sm mt-0.5">
                            {otpSending ? 'Sending OTP…' : `OTP sent to ${checkout?.contact.phone}`}
                        </p>
                    </div>

                    <div className="px-6 py-6 space-y-5">
                        {/* 6-box OTP input */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-neutral-700 block text-center">Enter 6-digit OTP</label>
                            <div className="flex items-center justify-center gap-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <input key={i}
                                        ref={el => { otpRefs.current[i] = el; }}
                                        type="text" inputMode="numeric" maxLength={1}
                                        value={otpDigits[i]} autoFocus={i === 0}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onPaste={handleOtpPaste}
                                        onFocus={e => e.target.select()}
                                        className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-150
                                            ${otpError
                                                ? 'border-red-400 bg-red-50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                                                : otpDigits[i]
                                                    ? 'border-neutral-800 bg-white text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200'
                                                    : 'border-neutral-200 bg-white text-neutral-800 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100'
                                            }`}
                                    />
                                ))}
                            </div>
                            {otpError && <p className="text-xs text-red-500 text-center font-medium">{otpError}</p>}
                        </div>

                        {/* Resend + close */}
                        <div className="flex items-center justify-between">
                            <button type="button"
                                onClick={() => { setOtpOpen(false); setOtpDigits(['', '', '', '', '', '']); setResendTimer(0); setOtpError(''); }}
                                className="text-sm text-neutral-500 hover:text-neutral-700 font-medium flex items-center gap-1 cursor-pointer transition-colors">
                                <ArrowLeft size={14} /> Cancel
                            </button>
                            {resendTimer > 0 ? (
                                <span className="text-sm text-neutral-400">Resend in {resendTimer}s</span>
                            ) : (
                                <button type="button" onClick={handleResend}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                                    <RotateCcw size={13} /> Resend OTP
                                </button>
                            )}
                        </div>

                        <button type="button" onClick={handleVerifyOtp}
                            disabled={otpVerifying || otpDigits.join('').length !== 6}
                            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed
                                text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-primary-200">
                            {otpVerifying ? 'Verifying…' : 'Confirm & Pay'}
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
        </>
    );
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-24 rounded-xl bg-white shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-(--border-muted)">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{n}</span>
                <Heading level={4} weight="semibold">{title}</Heading>
            </div>
            <div className="px-5 py-5">{children}</div>
        </section>
    );
}

function Feature({ n, label }: { n: number; label: string }) {
    return <span className="text-(--text-secondary)"><span className="font-semibold text-(--text-primary)">{n}</span> {label}</span>;
}

function DayBlock({ day, dateISO }: { day: PreviewDay; dateISO: string }) {
    return (
        <li className="rounded-lg border border-(--border-muted) overflow-hidden">
            <div className="flex items-center gap-2.5 bg-neutral-50 px-4 py-2.5 border-b border-(--border-muted)">
                <span className="rounded-full bg-primary-600 px-2.5 py-0.5 text-xs font-semibold text-white">Day {day.day}</span>
                <Text size="sm" weight="medium" intent="primary">{shortDate(dateISO)}</Text>
                <Text size="sm" intent="secondary" className="truncate">· {day.day_title}</Text>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
                {day.transfers?.map((t, i) => (
                    <Row key={`t${i}`} tag="Transfer" text={`${t.pickup_name ?? '—'} → ${t.drop_name ?? '—'}`} />
                ))}
                {day.hotel && (
                    <Row tag="Stay" text={`${day.hotel.hotel_name}${day.hotel.room_name ? ` · ${day.hotel.room_name}` : ''}${day.hotel.plan_name ? ` · ${day.hotel.plan_name}` : ''}`} />
                )}
                {day.meals && day.meals.length > 0 && (
                    <Row tag="Meals" text={day.meals.map((m) => m.label).join(', ')} />
                )}
                {day.activities?.map((a, i) => (
                    <Row key={`a${i}`} tag="Activity" text={a.name} muted={a.is_optional} suffix={a.is_optional ? 'optional' : undefined} />
                ))}
            </div>
        </li>
    );
}

function Row({ tag, text, muted, suffix }: { tag: string; text: string; muted?: boolean; suffix?: string }) {
    return (
        <div className="flex gap-3 text-sm">
            <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-(--text-muted) pt-0.5">{tag}</span>
            <span className={muted ? 'text-(--text-muted)' : 'text-(--text-primary)'}>
                {text}{suffix && <span className="ml-1.5 text-[11px] text-amber-600">({suffix})</span>}
            </span>
        </div>
    );
}

function PayOption({ selected, onSelect, title, amount, sub }: { selected: boolean; onSelect: () => void; title: string; amount: string; sub: string }) {
    return (
        <button type="button" onClick={onSelect}
            className={`w-full text-left cursor-pointer rounded-lg border px-3 py-2.5 transition ${selected ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50/60' : 'border-(--border-muted) hover:border-primary-300'}`}>
            <div className="flex items-center gap-2.5">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary-600' : 'border-neutral-300'}`}>
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <Text size="sm" weight="semibold" intent="primary">{title}</Text>
                        <Text size="sm" weight="bold" intent="primary">{amount}</Text>
                    </div>
                    <Text size="xs" intent="muted" className="block mt-0.5">{sub}</Text>
                </div>
            </div>
        </button>
    );
}
