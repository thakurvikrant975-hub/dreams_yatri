'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CarProfileIcon, BedIcon, ParachuteIcon, ForkKnifeIcon, type Icon } from '@phosphor-icons/react';
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
    const [expired, setExpired] = useState(quote.status !== 'ACTIVE');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkout, setCheckout] = useState<CheckoutInput | null>(null);
    const [policy, setPolicy] = useState(false);

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

    async function handleProceed() {
        setError(null);
        if (!checkout) { setError('Please complete all traveller and contact details.'); return; }
        if (!policy) { setError('Please accept the booking policies to continue.'); return; }
        setSubmitting(true);
        try {
            const res = await createBookingDraft(quote.id, { paymentChoice: effectiveChoice, details: checkout });
            if (!res.success) {
                setSubmitting(false);
                setError(
                    res.reason === 'unauthenticated' ? 'Please log in to continue your booking.'
                        : res.reason === 'stale' ? 'The price changed since this quote was created. Please refresh for the latest price.'
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
                                        <span className="shrink-0 rounded-md border border-orange-200 px-2 py-0.5 text-[11px] font-semibold text-transparent bg-clip-text bg-linear-to-r from-red-500 via-orange-500 to-amber-600">Customizable</span>
                                    </div>
                                    <Text size="sm" intent="secondary" weight="medium" className="block ">{quote.duration_label} · {quote.stay_category_label}</Text>
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
                    <aside className="lg:sticky lg:top-20 flex flex-col gap-4">
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
                        <Card className=" overflow-hidden">
                            <div className="px-5 py-4 border-b border-(--border-muted)">
                                <div className="flex items-center justify-between">
                                    <Text size="xs" intent="secondary" weight="medium" className="uppercase tracking-wide">Grand Total · {totalPax} traveller{totalPax !== 1 ? 's' : ''}</Text>
                                </div>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-(--text-primary) font-heading">{fmt(quote.total_amount)}</span>
                                    <span className="text-xs text-secondary">(incl. GST)</span>
                                </div>
                                <Text size="sm" weight="semibold" className="text-primary-500 block mt-1">
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
                                    <Text size="sm" weight="semibold" intent="primary" className="font-heading">{fmt(baseAmount)}</Text>
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
                                    <input type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary-500" />
                                    <Text size="xs" intent="secondary">
                                        I confirm I have read and accept the{' '}
                                        <Link href="/cancellation-policy" target="_blank" className="text-primary-500 underline">Cancellation Policy</Link>,{' '}
                                        <Link href="/terms" target="_blank" className="text-primary-500 underline">Terms of Service</Link>{' '}and{' '}
                                        <Link href="/privacy-policy" target="_blank" className="text-primary-500 underline">Privacy Policy</Link>.
                                    </Text>
                                </label>

                                <Button variant="premium" size="lg" className="w-full mt-4" onClick={handleProceed} loading={submitting} disabled={!canProceed}>
                                    {!schedule ? 'Unavailable' : !checkout ? 'Complete Traveller Details' : !policy ? 'Accept Policies to Continue' : 'Proceed to Payments'}
                                </Button>

                                {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}
                            </div>
                        </Card>

                        {/* Countdown */}
                        <Card className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-3">
                            <div>
                                <Text size="sm" weight="semibold" intent="primary" className="block">Complete booking in</Text>
                                <Text size="xs" intent="muted" className="block">The package price will refresh after that</Text>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                                <QuoteCountdown expiresAt={quote.expires_at} onExpire={() => setExpired(true)} />
                            </span>
                        </Card>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-24 rounded-xl">
            <Card>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-(--border-muted)">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-50 text-xs font-bold text-secondary ring-1 ring-inset ring-neutral-200 shadow-sm shadow-neutral-200/80 font-heading">{n}</span>
                    <Heading level={4} weight="semibold">{title}</Heading>
                </div>
                <div className="px-5 py-5">{children}</div>
            </Card>
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
                <span className="rounded-full bg-primary-500 px-2.5 py-0.5 text-xs font-semibold text-white">Day {day.day}</span>
                <Text size="sm" weight="medium" intent="primary">{shortDate(dateISO)}</Text>
                <Text size="sm" intent="secondary" className="truncate">· {day.day_title}</Text>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
                {day.transfers?.map((t, i) => (
                    <Row key={`t${i}`} icon={CarProfileIcon} tag="Transfer" text={`${t.pickup_name ?? '—'} → ${t.drop_name ?? '—'}`}
                        suffix={[t.distance_km ? `${Math.round(t.distance_km)} km` : null, t.vehicle_name].filter(Boolean).join(' · ') || undefined} />
                ))}

                {day.hotel && (() => {
                    const hotelImg = day.hotel.room_image || day.hotel.image || null;
                    const mealsIncluded = day.meals && day.meals.length > 0;
                    return (
                        <div className="flex gap-3">
                            <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--text-muted) pt-0.5">
                                <BedIcon className="size-6 text-muted scale-95" weight="duotone" /> 
                                <span className="text-secondary"> Stay</span>
                               
                            </span>
                            <div className="flex flex-1 gap-3 min-w-0">
                                {hotelImg && (
                                    <div className="relative w-20 h-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                        <Image src={hotelImg} alt={day.hotel.hotel_name} fill className="object-cover" sizes="96px" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Text size="sm" weight="semibold" intent="primary" className="block">{day.hotel.hotel_name}</Text>
                                    {(day.hotel.room_name || day.hotel.plan_name) && (
                                        <Text size="xs" intent="secondary" className="block">{[day.hotel.room_name, day.hotel.plan_name].filter(Boolean).join(' · ')}</Text>
                                    )}
                                    <span className={`mt-0.5 block text-xs ${mealsIncluded ? 'text-success-600' : 'text-(--text-muted)'}`}>
                                        {mealsIncluded ? `✓ ${day.meals!.map((m) => m.label).join(', ')} included` : 'Room only · meals not included'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {!day.hotel && day.meals && day.meals.length > 0 && (
                    <Row icon={ForkKnifeIcon} tag="Meals" text={`${day.meals.map((m) => m.label).join(', ')} included`} />
                )}

                {day.activities?.map((a, i) => {
                    const meta = [a.category, a.duration_hours ? `${a.duration_hours} hr${a.duration_hours !== 1 ? 's' : ''}` : null, a.difficulty].filter(Boolean).join(' · ');
                    return (
                        <div key={`a${i}`} className="flex gap-3">
                            <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--text-muted) pt-0.5">
                                <ParachuteIcon className="size-6 text-muted" weight="duotone" />
                                <span className="text-secondary">Activity</span>
                            </span>
                            <div className="flex flex-1 gap-3 min-w-0">
                                {a.image && (
                                    <div className="relative w-20 h-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                        <Image src={a.image} alt={a.name} fill className="object-cover" sizes="96px" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Text size="sm" weight="medium" intent={a.is_optional ? 'secondary' : 'primary'} className="block">
                                        {a.name}
                                        {a.is_optional && <span className="ml-1.5 text-[11px] text-amber-600">(optional)</span>}
                                    </Text>
                                    {meta && <Text size="xs" intent="muted" className="block mt-0.5">{meta}</Text>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </li>
    );
}

function Row({ tag, text, suffix, icon: IconC }: { tag: string; text: string; suffix?: string; icon?: Icon }) {
    return (
        <div className="flex gap-3 text-sm">
            <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--text-muted) pt-0.5">
                {IconC && <IconC className="size-6 text-muted" weight="duotone" />}
                <span className='text-secondary'>{tag}</span>
                
            </span>
            <span className="text-(--text-primary)">
                {text}{suffix && <span className="ml-2 text-xs text-secondary">· {suffix}</span>}
            </span>
        </div>
    );
}

function PayOption({ selected, onSelect, title, amount, sub }: { selected: boolean; onSelect: () => void; title: string; amount: string; sub: string }) {
    return (
        <button type="button" onClick={onSelect}
            className={`w-full text-left rounded-lg border px-3 py-2.5 transition ${selected ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50/60' : 'border-(--border-muted) hover:border-primary-300'}`}>
            <div className="flex items-center gap-2.5">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary-500' : 'border-neutral-300'}`}>
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
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
