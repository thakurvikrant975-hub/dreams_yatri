'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/app/components/forms/Input';
import { checkoutSchema, travellerSchema, type CheckoutInput, type TravellerInput } from '@/app/actions/quote/checkout-schema';

type Pax = { adults: number; children: number; infants: number };

function initialTravellers({ adults, children, infants }: Pax): TravellerInput[] {
    const mk = (type: TravellerInput['type']): TravellerInput => ({ type, firstName: '', lastName: '', dob: '', gender: 'MALE' });
    return [
        ...Array.from({ length: adults }, () => mk('ADULT')),
        ...Array.from({ length: children }, () => mk('CHILD')),
        ...Array.from({ length: infants }, () => mk('INFANT')),
    ];
}

const GENDERS: { value: TravellerInput['gender']; label: string }[] = [
    { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' }, { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const selectCls =
    'h-11 w-full rounded-xl bg-white px-3 text-sm font-medium text-(--text-primary) ring-[0.09em] ring-inset ring-neutral-400/80 outline-none hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400';

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
    return <label htmlFor={htmlFor} className="block text-xs font-medium text-(--text-secondary) mb-1.5">{children}</label>;
}

/** Collects traveller + contact (+ optional GST) details; reports a valid CheckoutInput (or null) to the parent. */
export default function CheckoutForm({ pax, onChange }: { pax: Pax; onChange: (v: CheckoutInput | null) => void }) {
    const [travellers, setTravellers] = useState<TravellerInput[]>(() => initialTravellers(pax));
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [gst, setGst] = useState('');
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const parsed = checkoutSchema.safeParse({ travellers, contact: { email, phone }, gstStateCode: gst });
        onChange(parsed.success ? parsed.data : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [travellers, email, phone, gst]);

    const markTouched = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
    function setField(i: number, key: keyof TravellerInput, value: string) {
        setTravellers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));
    }

    // Per-field error (only after the field is touched).
    const travErr = (i: number, key: keyof TravellerInput): string | undefined => {
        if (!touched[`t${i}.${key}`]) return undefined;
        const res = travellerSchema.safeParse(travellers[i]);
        if (res.success) return undefined;
        return res.error.issues.find((iss) => iss.path[0] === key)?.message;
    };
    const emailErr = touched.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email.' : undefined;
    const phoneErr = touched.phone && !/^[+\d][\d\s\-().]{6,}$/.test(phone) ? 'Enter a valid phone number.' : undefined;

    const labelFor = (t: TravellerInput, i: number, all: TravellerInput[]) => {
        const sameType = all.slice(0, i + 1).filter((x) => x.type === t.type).length;
        const word = t.type === 'ADULT' ? 'Adult' : t.type === 'CHILD' ? 'Child' : 'Infant';
        return `${word} ${sameType}`;
    };

    return (
        <div className="flex flex-col gap-5">
            {travellers.map((t, i) => (
                <div key={i} className="rounded-xl border border-(--border-muted) p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-50 px-2 text-xs font-semibold text-primary-600">{labelFor(t, i, travellers)}</span>
                        {i === 0 && <span className="text-xs font-medium text-(--text-secondary)">Lead traveller</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label>First name</Label>
                            <Input value={t.firstName} placeholder="First name" onChange={(e) => setField(i, 'firstName', e.target.value)} onBlur={() => markTouched(`t${i}.firstName`)} error={travErr(i, 'firstName')} />
                        </div>
                        <div>
                            <Label>Last name</Label>
                            <Input value={t.lastName} placeholder="Last name" onChange={(e) => setField(i, 'lastName', e.target.value)} onBlur={() => markTouched(`t${i}.lastName`)} error={travErr(i, 'lastName')} />
                        </div>
                        <div>
                            <Label>Date of birth</Label>
                            <Input type="date" max={new Date().toISOString().slice(0, 10)} value={t.dob} onChange={(e) => setField(i, 'dob', e.target.value)} onBlur={() => markTouched(`t${i}.dob`)} error={travErr(i, 'dob')} />
                        </div>
                        <div>
                            <Label>Gender</Label>
                            <select className={selectCls} value={t.gender} onChange={(e) => setField(i, 'gender', e.target.value)}>
                                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            ))}

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
        </div>
    );
}
