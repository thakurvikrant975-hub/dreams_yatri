'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {BedIcon, CarProfileIcon, TicketIcon,CheckCircleIcon, ClockIcon, WarningCircleIcon, ArrowsClockwiseIcon,DownloadSimpleIcon, ArrowRightIcon, TrendUpIcon, TrendDownIcon, type Icon,} from '@phosphor-icons/react';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Heading, Text } from '@/app/components/ui/Typography';
import { chooseReplacement } from '@/app/actions/fulfillment.actions';
import StatusAutoRefresh from './StatusAutoRefresh';
import type { BookingFulfillment, FulfillmentItem, FulfillmentState, ItemKind, ReplacementOfferView } from '@/app/services/fulfillment/status.service';

const KIND_ICON: Record<ItemKind, Icon> = { HOTEL: BedIcon, TRANSFER: CarProfileIcon, ACTIVITY: TicketIcon };

const STATUS_META: Record<FulfillmentState, { label: string; cls: string; icon: Icon; iconCls: string }> = {
    AWAITING_PAYMENT: { label: 'Awaiting payment', cls: 'bg-neutral-100 text-neutral-600', icon: ClockIcon, iconCls: 'text-neutral-400' },
    IN_PROCESS:       { label: 'In process',        cls: 'bg-warning-50 text-warning-700', icon: ClockIcon, iconCls: 'text-warning-500' },
    CONFIRMED:        { label: 'Confirmed',         cls: 'bg-success-50 text-success-700', icon: CheckCircleIcon, iconCls: 'text-success-600' },
    UNAVAILABLE:      { label: 'Finding alternative', cls: 'bg-error-50 text-error-700',   icon: WarningCircleIcon, iconCls: 'text-error-500' },
    REPLACED:         { label: 'Replaced',          cls: 'bg-primary-50 text-primary-700', icon: ArrowsClockwiseIcon, iconCls: 'text-primary-500' },
    CANCELLED:        { label: 'Cancelled',         cls: 'bg-neutral-100 text-neutral-500', icon: WarningCircleIcon, iconCls: 'text-neutral-400' },
};

function StatusChip({ status }: { status: FulfillmentState }) {
    const m = STATUS_META[status];
    const I = m.icon;
    return (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>
            <I weight="fill" className={`size-3.5 ${m.iconCls}`} /> {m.label}
        </span>
    );
}

function ItemRow({ item, payExtraHref }: { item: FulfillmentItem; payExtraHref: string | null }) {
    const KindI = KIND_ICON[item.kind];
    const confirmed = item.status === 'CONFIRMED' || item.status === 'REPLACED';
    return (
        <div className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${confirmed ? 'bg-success-50 text-success-600' : 'bg-neutral-100 text-(--text-secondary)'}`}>
                <KindI weight="duotone" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Text size="sm" weight="semibold" intent="primary" className="truncate">{item.title}</Text>
                    <StatusChip status={item.status} />
                </div>
                {item.subtitle && <Text size="xs" intent="muted" className="block mt-0.5">{item.subtitle}</Text>}

                {/* Hotel changed notice */}
                {item.hotelChanged && (
                    <div className="mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-warning-700">
                            <ArrowsClockwiseIcon weight="bold" className="size-3.5" />
                            <span>Hotel changed</span>
                            {item.hotelPriceDiff != null && item.hotelPriceDiff !== 0 && (
                                <span className={`ml-1 font-bold ${item.hotelPriceDiff > 0 ? 'text-error-600' : 'text-success-600'}`}>
                                    · {item.hotelPriceDiff > 0 ? '+' : '−'}{fmtRupees(Math.abs(item.hotelPriceDiff))}
                                </span>
                            )}
                        </div>
                        {item.originalHotelName && (
                            <div className="mt-1 flex items-center gap-1.5 text-warning-600">
                                <span className="text-warning-400">From:</span>
                                <span className="line-through opacity-70">{item.originalHotelName}</span>
                                <span className="text-warning-400">→</span>
                                <span className="font-medium text-warning-800">{item.title}</span>
                            </div>
                        )}
                        {item.hotelPriceDiff != null && item.hotelPriceDiff !== 0 && (
                            <div className="mt-0.5 text-warning-500">
                                {item.hotelPriceDiff > 0
                                    ? 'Your package price has been adjusted upward for this change.'
                                    : 'Your package price has been adjusted downward for this change.'}
                            </div>
                        )}
                        {item.hotelPriceDiff != null && item.hotelPriceDiff > 0 && payExtraHref && (
                            <Link href={payExtraHref} className="mt-1 inline-flex items-center gap-1 font-semibold text-warning-700 hover:text-warning-800">
                                Pay the difference <ArrowRightIcon weight="bold" className="size-3" />
                            </Link>
                        )}
                        <div className="mt-1.5 pt-1.5 border-t border-warning-200/70 text-warning-600">
                            Note: Hotel changed due to Unavailability
                        </div>
                    </div>
                )}

                {/* Room upgraded/downgraded notice (same hotel, different room/plan) */}
                {!item.hotelChanged && item.roomChanged && (
                    <div className="mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-warning-700">
                            {item.hotelPriceDiff != null && item.hotelPriceDiff > 0 ? <TrendUpIcon weight="bold" className="size-3.5" />
                                : item.hotelPriceDiff != null && item.hotelPriceDiff < 0 ? <TrendDownIcon weight="bold" className="size-3.5" />
                                : <ArrowsClockwiseIcon weight="bold" className="size-3.5" />}
                            <span>
                                {item.hotelPriceDiff != null && item.hotelPriceDiff > 0 ? 'Room upgraded'
                                    : item.hotelPriceDiff != null && item.hotelPriceDiff < 0 ? 'Room downgraded'
                                    : 'Room changed'}
                            </span>
                            {item.hotelPriceDiff != null && item.hotelPriceDiff !== 0 && (
                                <span className={`ml-1 font-bold ${item.hotelPriceDiff > 0 ? 'text-error-600' : 'text-success-600'}`}>
                                    · {item.hotelPriceDiff > 0 ? '+' : '−'}{fmtRupees(Math.abs(item.hotelPriceDiff))}
                                </span>
                            )}
                        </div>
                        {item.originalRoomType && item.newRoomType && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap text-warning-600">
                                <span className="text-warning-400">From:</span>
                                <span className="line-through opacity-70">{item.originalRoomType}</span>
                                <span className="text-warning-400">→</span>
                                <span className="font-medium text-warning-800">{item.newRoomType}</span>
                            </div>
                        )}
                        {item.hotelPriceDiff != null && item.hotelPriceDiff > 0 && payExtraHref && (
                            <Link href={payExtraHref} className="mt-1 inline-flex items-center gap-1 font-semibold text-warning-700 hover:text-warning-800">
                                Pay the difference <ArrowRightIcon weight="bold" className="size-3" />
                            </Link>
                        )}
                    </div>
                )}

                {/* Cab changed notice */}
                {item.cabChanged && (
                    <div className="mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-warning-700">
                            <ArrowsClockwiseIcon weight="bold" className="size-3.5" />
                            <span>Cab changed</span>
                            {item.cabPriceDiff != null && item.cabPriceDiff !== 0 && (
                                <span className={`ml-1 font-bold ${item.cabPriceDiff > 0 ? 'text-error-600' : 'text-success-600'}`}>
                                    · {item.cabPriceDiff > 0 ? '+' : '−'}{fmtRupees(Math.abs(item.cabPriceDiff))}
                                </span>
                            )}
                        </div>
                        {item.originalVehicleName && (
                            <div className="mt-1 flex items-center gap-1.5 text-warning-600">
                                <span className="text-warning-400">From:</span>
                                <span className="line-through opacity-70">{item.originalVehicleName}</span>
                                <span className="text-warning-400">→</span>
                                <span className="font-medium text-warning-800">{item.subtitle}</span>
                            </div>
                        )}
                        {item.cabPriceDiff != null && item.cabPriceDiff !== 0 && (
                            <div className="mt-0.5 text-warning-500">
                                {item.cabPriceDiff > 0
                                    ? 'Your package price has been adjusted upward for this change.'
                                    : 'Your package price has been adjusted downward for this change.'}
                            </div>
                        )}
                        {item.cabPriceDiff != null && item.cabPriceDiff > 0 && payExtraHref && (
                            <Link href={payExtraHref} className="mt-1 inline-flex items-center gap-1 font-semibold text-warning-700 hover:text-warning-800">
                                Pay the difference <ArrowRightIcon weight="bold" className="size-3" />
                            </Link>
                        )}
                    </div>
                )}

                {/* Activity: free vs paid */}
                {item.kind === 'ACTIVITY' && !item.paid && (
                    <Text size="xs" className="mt-0.5 block text-success-600">Included — no extra cost</Text>
                )}

                {/* Cab driver details, once assigned */}
                {item.kind === 'TRANSFER' && item.driver?.name && (
                    <Text size="xs" intent="secondary" className="mt-1 block">
                        Driver: {item.driver.name}{item.driver.phone ? ` · ${item.driver.phone}` : ''}{item.driver.vehicleNumber ? ` · ${item.driver.vehicleNumber}` : ''}
                    </Text>
                )}

                {/* Voucher */}
                {item.voucherUrl && (
                    <a href={item.voucherUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700">
                        <DownloadSimpleIcon weight="bold" className="size-3.5" />
                        {item.kind === 'ACTIVITY' ? 'View ticket' : 'View voucher'}
                    </a>
                )}

                {/* Ops-proposed alternatives (item unavailable) */}
                {item.offer && item.offer.options.length > 0 && <OfferPicker offer={item.offer} />}
            </div>
        </div>
    );
}

function OfferPicker({ offer }: { offer: ReplacementOfferView }) {
    const router = useRouter();
    const [sel, setSel] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function confirm() {
        if (!sel) { setErr('Please select an option.'); return; }
        setBusy(true); setErr(null);
        try {
            const res = await chooseReplacement(offer.id, sel);
            if (!res.success) { setErr(res.error); return; }
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mt-2 rounded-lg border border-error-200 bg-error-50/50 p-3">
            <Text size="xs" weight="semibold" className="text-error-700 block mb-1.5">Choose an alternative</Text>
            <div className="flex flex-col gap-1.5">
                {offer.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name={`offer-${offer.id}`} checked={sel === o.id} onChange={() => setSel(o.id)} className="accent-primary-600" />
                        <span className="text-(--text-primary)">{o.label}</span>
                        {o.sublabel && <span className="text-xs text-(--text-muted)">· {o.sublabel}</span>}
                    </label>
                ))}
            </div>
            {err && <Text size="xs" intent="error" className="mt-1 block">{err}</Text>}
            <button onClick={confirm} disabled={busy} className="mt-2 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {busy ? 'Confirming…' : 'Confirm choice'}
            </button>
        </div>
    );
}

const fmt = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const fmtRupees = (r: number) => `₹${Math.round(r).toLocaleString('en-IN')}`;

export interface PaymentSummary {
    status: string;
    totalPaise: number;
    /** The originally quoted total, frozen at booking time — compared against
     * `totalPaise` to surface any post-booking hotel/room price change. */
    originalTotalPaise: number;
    /** `totalPaise - originalTotalPaise` — positive means the price went up
     * (e.g. a hotel swap to a pricier room), negative means it went down. */
    priceDeltaPaise: number;
    /** Sum of actually-captured payments — never assumed from the total, so
     * this stays correct even if the price changes after payment. */
    paidPaise: number;
    /** `totalPaise - paidPaise` — positive: still owed; negative: overpaid,
     * a refund is due; zero: fully settled. */
    amountDuePaise: number;
    balanceDueDate: string | null;
    travellers: number;
    hotelCost: number | null;
    mealCost: number | null;
    cabCost: number | null;
    gstAmount: number | null;
    gstPct: number | null;
}

function paymentBarColor(pct: number): string {
    if (pct >= 100) return 'bg-success-500';
    if (pct >= 60)  return 'bg-primary-500';
    if (pct >= 30)  return 'bg-warning-500';
    return 'bg-error-500';
}

function paymentLabelColor(pct: number): string {
    if (pct >= 100) return 'text-success-600';
    if (pct >= 60)  return 'text-primary-600';
    if (pct >= 30)  return 'text-warning-600';
    return 'text-error-600';
}

function PaymentCard({ payment, payHref }: { payment: PaymentSummary; payHref: string }) {
    const hasPaid = payment.paidPaise > 0;
    const hasBalance = payment.amountDuePaise > 0;
    const hasRefund = payment.amountDuePaise < 0;
    const refundPaise = Math.abs(payment.amountDuePaise);
    const fullyPaid = payment.amountDuePaise === 0 && hasPaid;
    const priceWentUp = payment.priceDeltaPaise > 0;
    const priceChanged = payment.priceDeltaPaise !== 0;
    // Paid-so-far is real (sum of captured payments), so this can legitimately
    // read below 100% even on a "fully paid" booking if the price went up
    // afterward (e.g. a hotel/room swap) — it's never assumed from the total.
    const pct = payment.totalPaise > 0 ? Math.min(100, Math.round((payment.paidPaise / payment.totalPaise) * 100)) : 0;

    return (
        <Card className="overflow-hidden">
            {/* Grand total */}
            <div className="px-5 py-4 border-b border-(--border-muted)">
                <Text size="xs" intent="secondary" weight="medium" className="uppercase tracking-wide block">
                    Package Total · {payment.travellers} traveller{payment.travellers !== 1 ? 's' : ''}
                </Text>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-(--text-primary) font-heading">{fmt(payment.totalPaise)}</span>
                    <span className="text-xs text-(--text-muted)">(incl. GST)</span>
                </div>

                {/* Price change notice — shown whenever the current total differs
                    from what was originally quoted (e.g. a hotel/room swap). */}
                {priceChanged && (
                    <div className={`mt-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
                        priceWentUp ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'
                    }`}>
                        {priceWentUp ? <TrendUpIcon weight="bold" className="size-3.5 shrink-0" /> : <TrendDownIcon weight="bold" className="size-3.5 shrink-0" />}
                        <span className="font-semibold">
                            Price {priceWentUp ? 'increased' : 'decreased'} by {fmt(Math.abs(payment.priceDeltaPaise))}
                        </span>
                        <span className="text-(--text-muted)">(was {fmt(payment.originalTotalPaise)})</span>
                    </div>
                )}

                {/* Price breakdown — was computed and passed through but never
                    actually shown; each row is only as trustworthy as the
                    frozen itinerary snapshot it's read from. */}
                {(payment.hotelCost != null || payment.mealCost != null || payment.cabCost != null || payment.gstAmount != null) && (
                    <div className="mt-3 pt-3 border-t border-(--border-muted) flex flex-col gap-1">
                        {payment.hotelCost != null && (
                            <div className="flex justify-between text-xs">
                                <Text size="xs" intent="secondary">Hotels</Text>
                                <Text size="xs" intent="secondary">{fmtRupees(payment.hotelCost)}</Text>
                            </div>
                        )}
                        {payment.mealCost != null && (
                            <div className="flex justify-between text-xs">
                                <Text size="xs" intent="secondary">Meals</Text>
                                <Text size="xs" intent="secondary">{fmtRupees(payment.mealCost)}</Text>
                            </div>
                        )}
                        {payment.cabCost != null && (
                            <div className="flex justify-between text-xs">
                                <Text size="xs" intent="secondary">Cabs</Text>
                                <Text size="xs" intent="secondary">{fmtRupees(payment.cabCost)}</Text>
                            </div>
                        )}
                        {payment.gstAmount != null && (
                            <div className="flex justify-between text-xs">
                                <Text size="xs" intent="secondary">GST{payment.gstPct != null ? ` (${payment.gstPct}%)` : ''}</Text>
                                <Text size="xs" intent="secondary">{fmtRupees(payment.gstAmount)}</Text>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Payment status */}
            <div className="px-5 py-4 flex flex-col gap-2.5">
                <Text size="sm" weight="semibold" intent="primary" className="block">Payment Status</Text>

                {/* Progress bar */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <Text size="xs" intent="muted" weight="medium">
                            {hasPaid ? fmt(payment.paidPaise) : '₹0'} paid
                        </Text>
                        <span className={`text-xs font-semibold ${paymentLabelColor(pct)}`}>{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${paymentBarColor(pct)}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <Text size="sm" intent="secondary">Paid so far</Text>
                    <span className={`text-sm font-semibold ${hasPaid ? 'text-success-600' : 'text-(--text-muted)'}`}>
                        {hasPaid ? fmt(payment.paidPaise) : '₹0'}
                    </span>
                </div>

                <div className="flex justify-between items-center">
                    <Text size="sm" intent="secondary">{hasRefund ? 'Refund due' : 'Remaining'}</Text>
                    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${hasBalance ? 'text-error-600' : 'text-success-600'}`}>
                        {hasBalance ? fmt(payment.amountDuePaise) : hasRefund ? fmt(refundPaise) : (
                            <>₹0 <CheckCircleIcon weight="fill" className="size-3.5" /></>
                        )}
                    </span>
                </div>

                {payment.balanceDueDate && hasBalance && (
                    <Text size="xs" intent="muted" className="block">
                        Due by {payment.balanceDueDate}
                    </Text>
                )}

                {hasRefund ? (
                    <div className="mt-1 rounded-lg bg-success-50 border border-success-200 px-3 py-2 text-center">
                        <Text size="sm" weight="semibold" className="text-success-700">
                            You overpaid by {fmt(refundPaise)}
                        </Text>
                        <Text size="xs" intent="secondary" className="mt-0.5 block">
                            Our team will refund this to your original payment method.
                        </Text>
                    </div>
                ) : fullyPaid ? (
                    <div className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-success-50 border border-success-200 px-3 py-2">
                        <CheckCircleIcon weight="fill" className="size-4 text-success-600" />
                        <Text size="sm" weight="semibold" className="text-success-700">Fully Paid</Text>
                    </div>
                ) : hasBalance ? (
                    <Link href={payHref} className="inline-block mt-1">
                        <Button variant="premium" className="w-full">Pay {fmt(payment.amountDuePaise)} now</Button>
                    </Link>
                ) : null}
            </div>
        </Card>
    );
}

export default function StatusView({
    packageTitle, thumbnail, dateRange, bookingNumber, payHref, fulfillment, payment,
}: {
    packageTitle: string;
    thumbnail: string | null;
    dateRange: string;
    bookingNumber: string;
    payHref: string;
    fulfillment: BookingFulfillment;
    payment: PaymentSummary;
}) {
    const { overall, summary } = fulfillment;
    const pct = summary.total > 0 ? Math.round((summary.confirmed / summary.total) * 100) : 0;
    const payExtraHref = payment.status !== 'PENDING' && payment.amountDuePaise > 0 ? payHref : null;

    const headline =
        overall === 'AWAITING_PAYMENT' ? 'Complete your payment to start arrangements'
        : overall === 'READY' ? 'Your trip is fully confirmed'
        : overall === 'CANCELLED' ? 'This booking is cancelled'
        : 'We’re arranging your trip';
    const sub =
        overall === 'AWAITING_PAYMENT' ? 'Once your payment is received, our team starts confirming each hotel, transfer and activity.'
        : overall === 'READY' ? 'Every hotel, transfer and activity is confirmed. Your vouchers are below.'
        : overall === 'CANCELLED' ? 'No further arrangements are being made for this booking.'
        : `Each item is being confirmed with our partners. ${summary.confirmed} of ${summary.total} done so far.`;

    return (
        <div className="screen-space py-8">
            {overall === 'IN_PROGRESS' && <StatusAutoRefresh />}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
                {/* ── LEFT column ───────────────────────────────────────────── */}
                <div className="flex flex-col gap-4">
                    {/* Trip header */}
                    <Card className="overflow-hidden">
                        <div className="flex gap-4 p-5">
                            {thumbnail && (
                                <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                    <Image src={thumbnail} alt={packageTitle} fill className="object-cover" sizes="144px" />
                                </div>
                            )}
                            <div className="min-w-0 flex flex-col justify-center">
                                <Heading level={3} weight="semibold" className="truncate">{packageTitle}</Heading>
                                <Text size="sm" intent="secondary" className="block mt-1">{dateRange}</Text>
                                <Text size="xs" intent="muted" className="block mt-0.5">Booking {bookingNumber}</Text>
                            </div>
                        </div>
                    </Card>

                    {/* Overall progress */}
                    <Card className="px-6 py-5">
                        <div className="flex items-center gap-2">
                            {overall === 'READY' && <CheckCircleIcon weight="fill" className="size-5 shrink-0 text-success-600" />}
                            <Heading level={4} weight="semibold">{headline}</Heading>
                        </div>
                        <Text size="sm" intent="secondary" className="block mt-1">{sub}</Text>

                        {overall === 'AWAITING_PAYMENT' ? (
                            <Link href={payHref} className="inline-block mt-4">
                                <Button variant="premium">Complete payment</Button>
                            </Link>
                        ) : overall !== 'CANCELLED' && summary.total > 0 ? (
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <Text size="xs" intent="muted" weight="medium">{summary.confirmed} of {summary.total} confirmed</Text>
                                    <Text size="xs" intent="muted" weight="medium">{pct}%</Text>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                                    <div className="h-full rounded-full bg-success-500 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                {summary.attention > 0 && (
                                    <Text size="xs" className="mt-2 block text-error-600">
                                        {summary.attention} item{summary.attention !== 1 ? 's' : ''} need a replacement — our team will reach out with options.
                                    </Text>
                                )}
                            </div>
                        ) : null}
                    </Card>

                    {/* Per-day checklist */}
                    {fulfillment.days.map((d) => (
                        d.items.length === 0 ? null : (
                            <Card key={d.day} className="px-6 py-4">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <span className="rounded-full bg-primary-500 px-2.5 py-0.5 text-xs font-semibold text-white">Day {d.day}</span>
                                    <Text size="sm" weight="medium" intent="primary" className="truncate">{d.title}</Text>
                                </div>
                                <div className="divide-y divide-(--border-muted)">
                                    {d.items.map((it) => <ItemRow key={it.key} item={it} payExtraHref={payExtraHref} />)}
                                </div>
                            </Card>
                        )
                    ))}

                    <div className="text-center">
                        <Link href={`/bookings/${fulfillment.bookingId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                            Back to booking <ArrowRightIcon weight="bold" className="size-4" />
                        </Link>
                    </div>
                </div>

                {/* ── RIGHT column — payment summary ────────────────────────── */}
                <aside className="lg:sticky lg:top-6">
                    <PaymentCard payment={payment} payHref={payHref} />
                </aside>
            </div>
        </div>
    );
}