'use client';

import { useEffect, useMemo, useState } from 'react';
import { PencilSimpleIcon, PlusIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { Input } from '@/app/components/forms/Input';
import { checkoutSchema, type CheckoutInput, type TravellerInput } from '@/app/actions/quote/checkout-schema';
import TravellerModal, { isTravellerComplete } from './TravellerModal';

type Pax = { adults: number; children: number; infants: number };

function initialTravellers({ adults, children, infants }: Pax): TravellerInput[] {
    const mk = (type: TravellerInput['type']): TravellerInput => ({ type, firstName: '', lastName: '', dob: '', gender: 'MALE' });
    return [
        ...Array.from({ length: adults }, () => mk('ADULT')),
        ...Array.from({ length: children }, () => mk('CHILD')),
        ...Array.from({ length: infants }, () => mk('INFANT')),
    ];
}

function travellerLabels(list: TravellerInput[]): string[] {
    const seen: Record<string, number> = {};
    return list.map((t) => {
        const word = t.type === 'ADULT' ? 'Adult' : t.type === 'CHILD' ? 'Child' : 'Infant';
        seen[t.type] = (seen[t.type] ?? 0) + 1;
        return `${word} ${seen[t.type]}`;
    });
}

function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-medium text-(--text-secondary) mb-1.5">{children}</label>;
}

/** Collects traveller (via modal) + contact (+ optional GST) details; reports a valid CheckoutInput (or null) to the parent. */
export default function CheckoutForm({ pax, onChange }: { pax: Pax; onChange: (v: CheckoutInput | null) => void }) {
    const [travellers, setTravellers] = useState<TravellerInput[]>(() => initialTravellers(pax));
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [gst, setGst] = useState('');
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState(0);

    const labels = useMemo(() => travellerLabels(travellers), [travellers]);

    useEffect(() => {
        const parsed = checkoutSchema.safeParse({ travellers, contact: { email, phone }, gstStateCode: gst });
        onChange(parsed.success ? parsed.data : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [travellers, email, phone, gst]);

    const markTouched = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
    const emailErr = touched.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email.' : undefined;
    const phoneErr = touched.phone && !/^[+\d][\d\s\-().]{6,}$/.test(phone) ? 'Enter a valid phone number.' : undefined;

    function openModal(tab: number) {
        setModalTab(tab);
        setModalOpen(true);
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Traveller slots — tap to fill in the modal */}
            <div className="rounded-xl border border-(--border-muted) divide-y divide-(--border-muted)">
                {travellers.map((t, i) => {
                    const done = isTravellerComplete(t);
                    const name = `${t.firstName} ${t.lastName}`.trim();
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => openModal(i)}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50"
                        >
                            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-success-50 text-success-600' : 'bg-primary-50 text-primary-600'}`}>
                                {done ? <CheckCircleIcon weight="fill" className="size-5" /> : <PlusIcon weight="bold" className="size-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-(--text-primary)">
                                    {done ? name : `Add ${labels[i]}`}
                                </span>
                                <span className="block text-xs text-(--text-muted)">
                                    {done ? labels[i] + (i === 0 ? ' · Lead traveller' : '') : i === 0 ? 'Lead traveller — required' : 'Required'}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-600">
                                {done ? <><PencilSimpleIcon weight="bold" className="size-3.5" /> Edit</> : 'Add'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Contact + GST */}
            <div className="rounded-xl border border-(--border-muted) p-4">
                <div className="text-sm font-semibold text-primary mb-3">Contact details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Label>Email</Label>
                        <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched('email')} error={emailErr} />
                    </div>
                    <div>
                        <Label>Mobile number</Label>
                        <Input type="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => markTouched('phone')} error={phoneErr} />
                    </div>
                </div>
                <div className="mt-3">
                    <Label>GST number / state <span className="font-normal text-(--text-muted)">(optional)</span></Label>
                    <Input placeholder="For a GST invoice" value={gst} onChange={(e) => setGst(e.target.value)} />
                </div>
            </div>

            <TravellerModal
                open={modalOpen}
                travellers={travellers}
                labels={labels}
                initialTab={modalTab}
                onClose={() => setModalOpen(false)}
                onSave={setTravellers}
            />
        </div>
    );
}
