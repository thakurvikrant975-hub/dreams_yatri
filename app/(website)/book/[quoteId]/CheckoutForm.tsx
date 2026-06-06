'use client';

import { useEffect, useMemo, useState } from 'react';
import { PencilSimpleIcon, PlusIcon, CheckCircleIcon, UserCirclePlusIcon } from '@phosphor-icons/react';
import { Input } from '@/app/components/forms/Input';
import { Select, Option } from '@/app/components/forms/Select';
import { checkoutSchema, type CheckoutInput, type TravellerInput } from '@/app/actions/quote/checkout-schema';
import TravellerModal, { isTravellerComplete } from './TravellerModal';
import Label from '@/app/components/forms/Label';
import { PHONE_RULES, type CountryCode } from '@/app/lib/validators/login';

const COUNTRY_OPTIONS = [
    { code: '+91',  flag: '🇮🇳', label: 'IN' },
    { code: '+1',   flag: '🇺🇸', label: 'US' },
    { code: '+44',  flag: '🇬🇧', label: 'UK' },
    { code: '+61',  flag: '🇦🇺', label: 'AU' },
    { code: '+971', flag: '🇦🇪', label: 'AE' },
    { code: '+65',  flag: '🇸🇬', label: 'SG' },
    { code: '+60',  flag: '🇲🇾', label: 'MY' },
];

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



export default function CheckoutForm({ pax, onChange }: { pax: Pax; onChange: (v: CheckoutInput | null) => void }) {
    const [travellers, setTravellers] = useState<TravellerInput[]>(() => initialTravellers(pax));
    const [email, setEmail]           = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [phoneInput, setPhoneInput] = useState('');
    const [gst, setGst]               = useState('');
    const [touched, setTouched]       = useState<Record<string, boolean>>({});

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTab, setModalTab]   = useState(0);
    const labels = useMemo(() => travellerLabels(travellers), [travellers]);

    useEffect(() => {
        const phone = phoneInput ? `${countryCode}${phoneInput}` : '';
        const parsed = checkoutSchema.safeParse({ travellers, contact: { email, phone }, gstStateCode: gst });
        onChange(parsed.success ? parsed.data : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [travellers, email, phoneInput, countryCode, gst]);

    const markTouched = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
    const emailErr = touched.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email.' : undefined;
    const phoneErr = touched.phone && phoneInput && (() => {
        const rule = PHONE_RULES[countryCode as CountryCode];
        return rule && !rule.pattern.test(phoneInput) ? `Enter a valid ${rule.label} number (${rule.length} digits).` : undefined;
    })();

    return (
        <div className="flex flex-col gap-5">
            {/* Traveller slots */}
            <div className="rounded-xl border border-(--border-muted) divide-y divide-(--border-muted)">
                {travellers.map((t, i) => {
                    const done = isTravellerComplete(t);
                    const name = `${t.firstName} ${t.lastName}`.trim();
                    return (
                        <button key={i} type="button" onClick={() => { setModalTab(i); setModalOpen(true); }}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 rounded-xl bg-linear-to-b from-neutral-50 via-white to-white cursor-pointer ">
                            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm shadow-neutral-300 ${done ? ' text-success-600' : ' text-muted'}`}>
                                {done ? <CheckCircleIcon weight="fill" className="size-5" /> : <UserCirclePlusIcon weight="fill" className="size-7" />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-(--text-primary)">{done ? name : `Add ${labels[i]}`}</span>
                                <span className="block text-xs text-(--text-muted)">
                                    {done ? labels[i] + (i === 0 ? ' · Lead traveller' : '') : i === 0 ? 'Lead traveller — required' : 'Required'}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary-500">
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
                        <Label required>Email</Label>
                        <Input type="email" placeholder="you@example.com" value={email}
                            onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched('email')} error={emailErr} />
                    </div>
                    <div>
                        <Label required>Mobile number</Label>
                        <div className="flex gap-2">
                            <Select value={countryCode} onChange={setCountryCode} maxHeight="sm" className="min-w-28 h-11">
                                {COUNTRY_OPTIONS.map(({ code, flag, label }) => (
                                    <Option key={code} value={code}>{flag} {code}</Option>
                                ))}
                            </Select>
                            <Input type="tel" placeholder="98765 43210" value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                                onBlur={() => markTouched('phone')}
                                inputMode="numeric"
                                maxLength={PHONE_RULES[countryCode as CountryCode]?.length ?? 15}
                                error={phoneErr || undefined}
                                wrapperClassName="flex-1"
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-3">
                    <Label>GST number / state <span className="font-normal text-(--text-muted)">(optional)</span></Label>
                    <Input placeholder="For a GST invoice" value={gst} onChange={(e) => setGst(e.target.value)} />
                </div>
            </div>

            <TravellerModal open={modalOpen} travellers={travellers} labels={labels} initialTab={modalTab}
                onClose={() => setModalOpen(false)} onSave={setTravellers} />
        </div>
    );
}
