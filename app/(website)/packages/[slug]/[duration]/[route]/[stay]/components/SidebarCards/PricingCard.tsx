'use client';

import { useState } from 'react';
import { useBooking } from '../PackageBookingProvider';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';
import SavingsBadge from '@/app/components/packages/SavingBadge';
import type { DayPricingBreakdown, CabSegmentBreakdown } from '@/app/services/package-pricing.service';
import {
    ChevronDown, ChevronUp, Hotel, UtensilsCrossed, Zap, Car,
    Sparkles, IndianRupee, Users,
} from 'lucide-react';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function fakeOriginalPrice(price: number): number {
    const seed = (price % 97) / 97;
    const markup = 1.18 + seed * 0.26;
    return Math.ceil((price * markup) / 100) * 100 - 1;
}

// ── Pill chip ──────────────────────────────────────────────────────────────

type ChipColor = 'blue' | 'amber' | 'green' | 'orange' | 'slate' | 'violet';

function Chip({ children, color = 'slate' }: { children: React.ReactNode; color?: ChipColor }) {
    const cls: Record<ChipColor, string> = {
        blue:   'bg-blue-50   border-blue-200   text-blue-700',
        amber:  'bg-amber-50  border-amber-200  text-amber-700',
        green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
        orange: 'bg-orange-50 border-orange-200 text-orange-700',
        slate:  'bg-slate-50  border-slate-200  text-slate-600',
        violet: 'bg-violet-50 border-violet-200 text-violet-700',
    };
    return (
        <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${cls[color]}`}>
            {children}
        </span>
    );
}

// ── Day breakdown card ─────────────────────────────────────────────────────

function DayBreakdown({ day }: { day: DayPricingBreakdown }) {
    const included   = day.activities.filter(a => !a.is_optional);
    const optional   = day.activities.filter(a => a.is_optional);
    const hasContent = day.hotel || day.meals.length > 0 || included.length > 0
                     || optional.length > 0 || day.transfers.length > 0;

    if (!hasContent) return null;

    return (
        <div className="space-y-2">
            {/* Day header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-neutral-700">{day.day}</span>
                    </div>
                    <span className="text-xs font-semibold text-neutral-800 truncate">{day.day_title}</span>
                </div>
                {day.day_total > 0 && (
                    <span className="text-xs font-bold text-neutral-700 shrink-0">{fmt(day.day_total)}</span>
                )}
            </div>

            {/* Hotel */}
            {day.hotel && (
                <div className="ml-8 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Hotel className="h-3 w-3 text-blue-500 shrink-0" />
                            <span className="text-xs font-semibold text-blue-900 truncate">{day.hotel.hotel_name}</span>
                            {day.hotel.room_name && (
                                <span className="text-[10px] text-blue-600/80 truncate">· {day.hotel.room_name}</span>
                            )}
                        </div>
                        <span className="text-xs font-bold text-blue-800 shrink-0">{fmt(day.hotel.total)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <Chip color="blue">{day.hotel.rooms_count} room{day.hotel.rooms_count !== 1 ? 's' : ''}</Chip>
                        <Chip color="blue">{fmt(day.hotel.price_per_room)}/night</Chip>
                        <Chip color="blue">{day.hotel.num_nights} night{day.hotel.num_nights !== 1 ? 's' : ''}</Chip>
                        {day.hotel.plan_name && <Chip color="slate">{day.hotel.plan_name}</Chip>}
                    </div>
                    {day.hotel.mattresses_count > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-blue-100">
                            <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[10px] text-blue-700">Extra mattresses</span>
                                <Chip color="amber">{day.hotel.mattresses_count} × {fmt(day.hotel.extra_bed_rate)}/night</Chip>
                            </div>
                            <span className="text-[10px] font-semibold text-amber-700">
                                {fmt(day.hotel.mattresses_count * day.hotel.extra_bed_rate * day.hotel.num_nights)}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Meals */}
            {day.meals.length > 0 && (
                <div className="ml-8 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <UtensilsCrossed className="h-3 w-3 text-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Meals</span>
                    </div>
                    {day.meals.map((m, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="text-xs font-medium text-amber-900">{m.label}</span>
                                <Chip color="amber">{m.hotel_name}</Chip>
                                <Chip color="amber">{m.persons} pax × {fmt(m.price_per_person)}</Chip>
                            </div>
                            <span className="text-xs font-semibold text-amber-800 shrink-0">{fmt(m.total)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Activities */}
            {(included.length > 0 || optional.length > 0) && (
                <div className="ml-8 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Activities</span>
                    </div>
                    {included.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="text-xs font-medium text-emerald-900 truncate">{a.name}</span>
                                {a.pricing_type === 'PER_GROUP'
                                    ? <Chip color="green">Flat rate</Chip>
                                    : <Chip color="green">{a.adult_count} adult × {fmt(a.adult_price)}</Chip>}
                                {a.child_count > 0 && (
                                    <Chip color="green">{a.child_count} child × {fmt(a.child_price)}</Chip>
                                )}
                            </div>
                            <span className="text-xs font-semibold text-emerald-800 shrink-0">{fmt(a.total)}</span>
                        </div>
                    ))}
                    {optional.map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 opacity-50">
                            <span className="text-xs text-neutral-700 truncate">{a.name}</span>
                            <Chip color="slate">Optional</Chip>
                        </div>
                    ))}
                </div>
            )}

            {/* Transfers / Cab */}
            {(day.transfers.length > 0 || day.cab_cost > 0) && (
                <div className="ml-8 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2 space-y-1">
                    {day.transfers.map((t, idx) => (
                        <div key={t.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Car className="h-3 w-3 text-orange-500 shrink-0" />
                                <span className="text-xs font-medium text-orange-900 truncate">
                                    {t.pickup_name && t.drop_name
                                        ? `${t.pickup_name} → ${t.drop_name}`
                                        : 'Transfer'}
                                </span>
                                {t.distance_km != null && (
                                    <span className="text-[10px] text-orange-600">{t.distance_km} km</span>
                                )}
                            </div>
                            {idx === 0 && day.cab_cost > 0 && (
                                <span className="text-xs font-semibold text-orange-700 shrink-0">{fmt(day.cab_cost)}</span>
                            )}
                        </div>
                    ))}
                    {day.transfers.length === 0 && day.cab_cost > 0 && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Car className="h-3 w-3 text-orange-500" />
                                <span className="text-xs font-medium text-orange-900">Cab</span>
                            </div>
                            <span className="text-xs font-semibold text-orange-700">{fmt(day.cab_cost)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Cab segments ────────────────────────────────────────────────────────────

function CabDetails({ segments, label }: { segments: CabSegmentBreakdown[]; label: string | null }) {
    const [open, setOpen] = useState(false);
    if (segments.length === 0) return null;
    const hasUpgrade = segments.some(s => s.upgraded);
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-700 transition-colors mt-1"
            >
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {label ?? 'Cab'} breakdown
                {hasUpgrade && <Chip color="amber">↑ Upgraded</Chip>}
            </button>
            {open && (
                <div className="mt-1.5 space-y-1.5 pl-2 border-l-2 border-orange-200">
                    {segments.map((seg, i) => (
                        <div key={i} className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs font-semibold">{seg.vehicle_name}</span>
                                <Chip color="orange">{seg.vehicle_capacity} seats</Chip>
                                <Chip color="slate">Day {seg.day_from}–{seg.day_to}</Chip>
                                {seg.upgraded && <Chip color="amber">↑ from {seg.original_vehicle_name}</Chip>}
                                {seg.is_seasonal && (
                                    <Chip color="violet"><Sparkles className="h-2 w-2 mr-0.5" />Seasonal</Chip>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-neutral-500">
                                    {seg.pricing_type === 'PER_DAY'
                                        ? `${fmt(seg.price_used)}/day × ${seg.days} days`
                                        : `${fmt(seg.price_used)}/km × ${seg.km} km`}
                                </span>
                                <span className="text-xs font-semibold text-orange-700">{fmt(seg.total)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main PricingCard ────────────────────────────────────────────────────────

export default function PricingCard() {
    const { pricing, isPricingLoading, adults, childCount, infants } = useBooking();
    const [showBreakdown, setShowBreakdown] = useState(false);
    const totalPax = adults + childCount + infants;

    return (
        <Card className="px-5 py-5 space-y-4">
            {/* ── Loading skeleton ── */}
            {isPricingLoading && !pricing && (
                <div className="flex flex-col gap-3 animate-pulse">
                    <div className="h-4 w-24 rounded-full bg-neutral-200" />
                    <div className="h-8 w-36 rounded-lg bg-neutral-200" />
                    <div className="h-3 w-40 rounded-full bg-neutral-200" />
                </div>
            )}

            {pricing && (
                <>
                    {/* ── Headline price ── */}
                    <div>
                        <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
                            Price per adult
                        </Text>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <Text as="span" size="2xl" weight="bold" intent="primary" className="font-heading tracking-tight">
                                {fmt(pricing.pricePerAdult)}
                            </Text>
                            <Text as="span" size="sm" intent="secondary" className="font-heading">/ adult</Text>
                            {isPricingLoading && (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-500" />
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <Text as="span" size="sm" intent="muted" className="line-through">
                                {fmt(fakeOriginalPrice(pricing.pricePerAdult))}
                            </Text>
                            <SavingsBadge
                                amount={`${Math.round((1 - pricing.pricePerAdult / fakeOriginalPrice(pricing.pricePerAdult)) * 100)}% off`}
                                prefix=""
                            />
                        </div>
                    </div>

                    {/* ── Subtotal pills ── */}
                    {(pricing.hotel_subtotal > 0 || pricing.meal_subtotal > 0
                        || pricing.activity_subtotal > 0 || pricing.cab_subtotal > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                            {pricing.hotel_subtotal > 0 && (
                                <Chip color="blue">
                                    <Hotel className="h-2.5 w-2.5 mr-0.5" />
                                    Hotels {fmt(pricing.hotel_subtotal)}
                                </Chip>
                            )}
                            {pricing.meal_subtotal > 0 && (
                                <Chip color="amber">
                                    <UtensilsCrossed className="h-2.5 w-2.5 mr-0.5" />
                                    Meals {fmt(pricing.meal_subtotal)}
                                </Chip>
                            )}
                            {pricing.activity_subtotal > 0 && (
                                <Chip color="green">
                                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                                    Activities {fmt(pricing.activity_subtotal)}
                                </Chip>
                            )}
                            {pricing.cab_subtotal > 0 && (
                                <Chip color="orange">
                                    <Car className="h-2.5 w-2.5 mr-0.5" />
                                    Cab {fmt(pricing.cab_subtotal)}
                                </Chip>
                            )}
                        </div>
                    )}

                    {/* ── GST + total ── */}
                    <div className="space-y-1 border-t border-neutral-100 pt-3">
                        <div className="flex items-center justify-between">
                            <Text size="sm" intent="secondary">
                                GST ({pricing.gstPercentage}%)
                            </Text>
                            <Text size="sm" intent="secondary" weight="medium">
                                {fmt(pricing.gstAmount)}
                            </Text>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-neutral-400" />
                                <Text size="sm" intent="secondary">
                                    Total for {totalPax} traveller{totalPax !== 1 ? 's' : ''}
                                </Text>
                            </div>
                            <Text size="sm" weight="bold" intent="primary">
                                {fmt(pricing.finalPrice)}
                            </Text>
                        </div>
                    </div>

                    {/* ── View full breakdown toggle ── */}
                    {pricing.days.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowBreakdown(p => !p)}
                            className="flex items-center gap-1.5 text-xs font-medium text-primary/70 hover:text-primary transition-colors w-full"
                        >
                            {showBreakdown
                                ? <><ChevronUp className="h-3.5 w-3.5" /> Hide price breakdown</>
                                : <><ChevronDown className="h-3.5 w-3.5" /> View price breakdown</>}
                        </button>
                    )}

                    {/* ── Full day-by-day breakdown ── */}
                    {showBreakdown && pricing.days.length > 0 && (
                        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3 space-y-4">
                            <div className="flex items-center gap-1.5">
                                <IndianRupee className="h-3.5 w-3.5 text-neutral-500" />
                                <span className="text-xs font-bold text-neutral-700">
                                    {pricing.duration_label} · {pricing.stay_category_label}
                                </span>
                                <span className="text-[10px] text-neutral-400 ml-auto">
                                    {pricing.adults} adult{pricing.adults !== 1 ? 's' : ''}
                                    {pricing.children > 0 ? ` · ${pricing.children} child${pricing.children !== 1 ? 'ren' : ''}` : ''}
                                    {pricing.infants > 0 ? ` · ${pricing.infants} infant${pricing.infants !== 1 ? 's' : ''}` : ''}
                                </span>
                            </div>

                            {pricing.days.map(day => (
                                <DayBreakdown key={day.day} day={day} />
                            ))}

                            {/* Cab details */}
                            {pricing.cab_segments.length > 0 && (
                                <div className="border-t border-neutral-200 pt-3">
                                    <CabDetails segments={pricing.cab_segments} label={pricing.cab_type_label} />
                                </div>
                            )}

                            {/* Summary row */}
                            <div className="border-t border-neutral-200 pt-3 space-y-1">
                                {[
                                    { label: 'Hotels',     value: pricing.hotel_subtotal,    show: pricing.hotel_subtotal > 0,    color: 'text-blue-600'    },
                                    { label: 'Meals',      value: pricing.meal_subtotal,     show: pricing.meal_subtotal > 0,     color: 'text-amber-600'   },
                                    { label: 'Activities', value: pricing.activity_subtotal, show: pricing.activity_subtotal > 0, color: 'text-emerald-600' },
                                    { label: 'Cab',        value: pricing.cab_subtotal,      show: pricing.cab_subtotal > 0,      color: 'text-orange-600'  },
                                ].filter(r => r.show).map(r => (
                                    <div key={r.label} className="flex justify-between text-xs">
                                        <span className={`${r.color} font-medium`}>{r.label}</span>
                                        <span className="text-neutral-700 font-medium">{fmt(r.value)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-100">
                                    <span>GST ({pricing.gstPercentage}%)</span>
                                    <span>{fmt(pricing.gstAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1">
                                    <span>Total</span>
                                    <span>{fmt(pricing.finalPrice)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <Button variant="premium" className="w-full mt-1">
                Book this package
            </Button>
            <Button variant="outline" className="w-full mt-2">
                Book a call
            </Button>
        </Card>
    );
}
