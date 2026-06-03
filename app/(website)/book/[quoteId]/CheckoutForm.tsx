'use client';

import { useEffect, useState } from 'react';
import { Text } from '@/app/components/ui/Typography';
import { checkoutSchema, type CheckoutInput, type TravellerInput } from '@/app/actions/quote/checkout-schema';

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

const input = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400';

/** Collects traveller + contact (+ optional GST) details; reports a valid CheckoutInput (or null) to the parent. */
export default function CheckoutForm({ pax, onChange }: { pax: Pax; onChange: (v: CheckoutInput | null) => void }) {
    const [travellers, setTravellers] = useState<TravellerInput[]>(() => initialTravellers(pax));
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [gst, setGst] = useState('');

    useEffect(() => {
        const parsed = checkoutSchema.safeParse({ travellers, contact: { email, phone }, gstStateCode: gst });
        onChange(parsed.success ? parsed.data : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [travellers, email, phone, gst]);

    function setField(i: number, key: keyof TravellerInput, value: string) {
        setTravellers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));
    }

    const labelFor = (t: TravellerInput, i: number, all: TravellerInput[]) => {
        const sameType = all.slice(0, i + 1).filter((x) => x.type === t.type).length;
        return `${t.type === 'ADULT' ? 'Adult' : t.type === 'CHILD' ? 'Child' : 'Infant'} ${sameType}`;
    };

    return (
        <div className="flex flex-col gap-6">
            <section>
                <Text size="sm" weight="semibold" intent="primary" className="block mb-2">Traveller details</Text>
                <div className="flex flex-col gap-3">
                    {travellers.map((t, i) => (
                        <div key={i} className="rounded-lg border border-neutral-200 p-3">
                            <Text size="xs" intent="muted" className="block mb-2">{labelFor(t, i, travellers)}{i === 0 ? ' · Lead' : ''}</Text>
                            <div className="grid grid-cols-2 gap-2">
                                <input className={input} placeholder="First name" value={t.firstName} onChange={(e) => setField(i, 'firstName', e.target.value)} />
                                <input className={input} placeholder="Last name" value={t.lastName} onChange={(e) => setField(i, 'lastName', e.target.value)} />
                                <input className={input} type="date" max={new Date().toISOString().slice(0, 10)} value={t.dob} onChange={(e) => setField(i, 'dob', e.target.value)} />
                                <select className={input} value={t.gender} onChange={(e) => setField(i, 'gender', e.target.value)}>
                                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <Text size="sm" weight="semibold" intent="primary" className="block mb-2">Contact details</Text>
                <div className="grid grid-cols-2 gap-2">
                    <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input className={input} type="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
            </section>

            <section>
                <Text size="sm" weight="semibold" intent="primary" className="block mb-2">GST details <span className="font-normal text-neutral-400">(optional)</span></Text>
                <input className={input} placeholder="GST state code (optional)" value={gst} onChange={(e) => setGst(e.target.value)} />
            </section>
        </div>
    );
}
