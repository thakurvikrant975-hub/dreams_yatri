'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPinIcon, CalendarDaysIcon, UsersIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useBooking } from './PackageBookingProvider';
import { Text } from '@/app/components/ui/Typography';

interface Props {
    startingFrom: string; // first stop / pickup city from route
}

export default function TravelerInputBar({ startingFrom }: Props) {
    const {
        adults, childCount, infants, childAges,
        setAdults, setChildCount, setInfants, setChildAge,
        travelDate, setTravelDate,
    } = useBooking();

    const [travelerOpen, setTravelerOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!travelerOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setTravelerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [travelerOpen]);

    const travelerSummary = [
        `${adults} Adult${adults !== 1 ? 's' : ''}`,
        childCount > 0 ? `${childCount} Child${childCount !== 1 ? 'ren' : ''}` : '',
        infants > 0    ? `${infants} Infant${infants !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' · ');

    return (
        <div className="w-full border-b border-neutral-100 bg-neutral-50  rounded-xl">
            <div className="py-3 px-4 flex items-center justify-center gap-3 flex-wrap">
                {/* ── Starting from ── */}
                <div className="flex items-center gap-2 min-w-40">
                    <MapPinIcon className="size-4 text-muted shrink-0" />
                    <div>
                        <Text size="xss" intent="muted" weight="medium" className="uppercase tracking-wide">
                            Starting from
                        </Text>
                        <Text size="sm" intent="primary" weight="semibold">{startingFrom}</Text>
                    </div>
                </div>

                <div className="h-8 w-px bg-neutral-200 hidden sm:block" />

                {/* ── Date of travel ── */}
                <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="size-4 text-muted shrink-0" />
                    <div>
                        <Text size="xss" intent="muted" weight="medium" className="uppercase tracking-wide">
                            Date of travel
                        </Text>
                        <input
                            type="date"
                            value={travelDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setTravelDate(e.target.value)}
                            className="block text-sm font-semibold text-primary bg-transparent border-none outline-none cursor-pointer w-[130px]"
                        />
                    </div>
                </div>

                <div className="h-8 w-px bg-neutral-200 hidden sm:block" />

                {/* ── Travellers ── */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setTravelerOpen(v => !v)}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white hover:shadow-sm transition-all"
                    >
                        <UsersIcon className="size-4 text-muted shrink-0" />
                        <div className="text-left">
                            <Text size="xss" intent="muted" weight="medium" className="uppercase tracking-wide">
                                Travellers
                            </Text>
                            <Text size="sm" intent="primary" weight="semibold">{travelerSummary}</Text>
                        </div>
                        <span className="ml-1 text-muted text-xs">▾</span>
                    </button>

                    {travelerOpen && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-neutral-100 z-[300] p-4 flex flex-col gap-4">

                            <TravelerRow
                                label="Adults"
                                sub="12+ yrs"
                                value={adults}
                                min={1}
                                onChange={setAdults}
                            />
                            <TravelerRow
                                label="Children"
                                sub="2–11 yrs"
                                value={childCount}
                                min={0}
                                onChange={setChildCount}
                            />
                            <TravelerRow
                                label="Infants"
                                sub="0–1 yr"
                                value={infants}
                                min={0}
                                onChange={setInfants}
                            />

                            {/* Per-child age inputs */}
                            {childCount > 0 && (
                                <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
                                    <Text size="xs" intent="muted" weight="semibold" className="uppercase tracking-wide">
                                        Children&apos;s ages
                                    </Text>
                                    {Array.from({ length: childCount }).map((_, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <Text size="sm" intent="secondary">Child {i + 1}</Text>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setChildAge(i, (childAges[i] ?? 8) - 1)}
                                                    className="size-7 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50"
                                                >
                                                    <MinusIcon className="size-3" />
                                                </button>
                                                <Text size="sm" intent="primary" weight="semibold" className="w-10 text-center">
                                                    {childAges[i] ?? 8} yrs
                                                </Text>
                                                <button
                                                    onClick={() => setChildAge(i, (childAges[i] ?? 8) + 1)}
                                                    className="size-7 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50"
                                                >
                                                    <PlusIcon className="size-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => setTravelerOpen(false)}
                                className="w-full mt-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Reusable counter row ─────────────────────────────────────────────────────

function TravelerRow({
    label, sub, value, min, onChange,
}: {
    label: string; sub: string; value: number; min: number; onChange: (n: number) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <Text size="sm" intent="primary" weight="semibold">{label}</Text>
                <Text size="xs" intent="muted">{sub}</Text>
            </div>
            <div className="flex items-center gap-3">
                <button
                    disabled={value <= min}
                    onClick={() => onChange(value - 1)}
                    className="size-8 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <MinusIcon className="size-3.5" />
                </button>
                <Text size="base" intent="primary" weight="bold" className="w-5 text-center">{value}</Text>
                <button
                    onClick={() => onChange(value + 1)}
                    className="size-8 rounded-full border border-primary-200 bg-primary/5 flex items-center justify-center hover:bg-primary/10"
                >
                    <PlusIcon className="size-3.5 text-primary" />
                </button>
            </div>
        </div>
    );
}
