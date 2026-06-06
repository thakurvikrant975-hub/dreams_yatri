'use client';

import { useEffect, useState } from 'react';
import { Dialog, VisuallyHidden } from 'radix-ui';
import { XIcon, CheckCircleIcon, UserIcon } from '@phosphor-icons/react';
import { Input } from '@/app/components/forms/Input';
import { travellerSchema, type TravellerInput } from '@/app/actions/quote/checkout-schema';

const GENDERS: { value: TravellerInput['gender']; label: string }[] = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
    { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const selectCls =
    'h-11 w-full rounded-xl bg-white px-3 text-sm font-medium text-(--text-primary) ring-[0.09em] ring-inset ring-neutral-400/80 outline-none hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400';

function Label({ children }: { children: React.ReactNode }) {
    return (
        <label className="block text-xs font-medium text-(--text-secondary) mb-1.5">
            {children} <span className="text-red-500">*</span>
        </label>
    );
}

function calcAge(dob: string): number | null {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function dobLimits(type: TravellerInput['type']): { min: string; max: string } {
    const today = new Date();

    if (type === 'ADULT') {
        // Must be 12+ years old → latest allowed birth = today − 12 years
        const max = new Date(today);
        max.setFullYear(max.getFullYear() - 12);
        return { min: '1900-01-01', max: toISO(max) };
    }

    if (type === 'CHILD') {
        // 0 ≤ age < 12 → earliest allowed birth = 12 years ago + 1 day
        const min = new Date(today);
        min.setFullYear(min.getFullYear() - 12);
        min.setDate(min.getDate() + 1);
        return { min: toISO(min), max: toISO(today) };
    }

    // INFANT: age < 2
    const min = new Date(today);
    min.setFullYear(min.getFullYear() - 2);
    min.setDate(min.getDate() + 1);
    return { min: toISO(min), max: toISO(today) };
}

export function isTravellerComplete(t: TravellerInput): boolean {
    return travellerSchema.safeParse(t).success;
}

/**
 * MMT-style "Add Traveller Details" modal: one dialog, a tab per traveller.
 * Edits a draft copy and only commits (onSave) when every traveller validates;
 * "Confirm details" jumps to the first incomplete traveller if any are missing.
 */
export default function TravellerModal({
    open,
    travellers,
    labels,
    initialTab = 0,
    onClose,
    onSave,
}: {
    open: boolean;
    travellers: TravellerInput[];
    labels: string[];
    initialTab?: number;
    onClose: () => void;
    onSave: (next: TravellerInput[]) => void;
}) {
    const [draft, setDraft] = useState<TravellerInput[]>(travellers);
    const [active, setActive] = useState(initialTab);
    const [showErrors, setShowErrors] = useState(false);

    // Re-seed the draft each time the modal opens (so a cancelled edit is discarded).
    useEffect(() => {
        if (open) {
            setDraft(travellers);
            setActive(initialTab);
            setShowErrors(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const cur = draft[active];
    if (!cur) return null;

    function setField(key: keyof TravellerInput, value: string) {
        const processed =
            (key === 'firstName' || key === 'lastName') && value
                ? value.charAt(0).toUpperCase() + value.slice(1)
                : value;
        setDraft((prev) => prev.map((t, i) => (i === active ? { ...t, [key]: processed } : t)));
    }

    const fieldErr = (key: keyof TravellerInput): string | undefined => {
        if (!showErrors) return undefined;
        const res = travellerSchema.safeParse(cur);
        if (res.success) return undefined;
        return res.error.issues.find((iss) => iss.path[0] === key)?.message;
    };

    function confirm() {
        const firstBad = draft.findIndex((t) => !isTravellerComplete(t));
        if (firstBad !== -1) {
            setActive(firstBad);
            setShowErrors(true);
            return;
        }
        onSave(draft);
        onClose();
    }

    return (
        <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-[1px]" />
                <Dialog.Content
                    data-layout="website"
                    className="fixed left-1/2 top-1/2 z-9999 w-[min(40rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
                    aria-describedby={undefined}
                >
                    <VisuallyHidden.Root asChild>
                        <Dialog.Title>Add traveller details</Dialog.Title>
                    </VisuallyHidden.Root>

                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-(--border-muted) px-6 py-4">
                        <h2 className="text-base font-semibold text-(--text-primary)">Add traveller details</h2>
                        <Dialog.Close asChild>
                            <button aria-label="Close" className="flex size-8 cursor-pointer items-center justify-center rounded-full text-(--text-secondary) hover:bg-neutral-100">
                                <XIcon weight="bold" className="size-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Traveller tabs */}
                    <div className="flex gap-2 overflow-x-auto px-6 pt-5 pb-4 scrollbar-none">
                        {draft.map((t, i) => {
                            const done = isTravellerComplete(t);
                            const selected = i === active;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setActive(i)}
                                    className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${selected ? 'border-primary-500 bg-primary-50/70 text-primary-700 ring-2 ring-primary-200' : 'border-(--border-muted) text-(--text-secondary) hover:border-primary-300'}`}
                                >
                                    {done ? (
                                        <CheckCircleIcon weight="fill" className="size-4 text-success-600" />
                                    ) : (
                                        <UserIcon weight="duotone" className="size-4 opacity-70" />
                                    )}
                                    {labels[i]}
                                </button>
                            );
                        })}
                    </div>

                    {/* Form for the active traveller */}
                    <div className="px-6 pb-2">
                        <p className="mb-4 text-sm font-semibold text-(--text-primary)">
                            {labels[active]} {active === 0 && <span className="font-normal text-(--text-muted)">· Lead traveller</span>}
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label>First name</Label>
                                <Input value={cur.firstName} placeholder="First name" onChange={(e) => setField('firstName', e.target.value)} error={fieldErr('firstName')} />
                            </div>
                            <div>
                                <Label>Last name</Label>
                                <Input value={cur.lastName} placeholder="Last name" onChange={(e) => setField('lastName', e.target.value)} error={fieldErr('lastName')} />
                            </div>
                            <div>
                                <Label>Date of birth</Label>
                                <Input
                                    type="date"
                                    min={dobLimits(cur.type).min}
                                    max={dobLimits(cur.type).max}
                                    value={cur.dob}
                                    onChange={(e) => setField('dob', e.target.value)}
                                    error={fieldErr('dob')}
                                />
                                {calcAge(cur.dob) !== null && (
                                    <p className="mt-1.5 text-xs font-semibold text-primary-600">
                                        Age: {calcAge(cur.dob)} year{calcAge(cur.dob) !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Gender</Label>
                                <select className={selectCls} value={cur.gender} onChange={(e) => setField('gender', e.target.value)}>
                                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-(--border-muted) bg-neutral-50 px-6 py-4">
                        <span className="text-xs text-(--text-muted)">
                            {draft.filter(isTravellerComplete).length}/{draft.length} travellers complete
                        </span>
                        <button
                            type="button"
                            onClick={confirm}
                            className="cursor-pointer rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                        >
                            Confirm details
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
