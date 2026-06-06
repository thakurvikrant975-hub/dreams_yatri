'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { PencilSimpleIcon, PlusIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { ArrowLeft, CheckCircle2, RotateCcw } from 'lucide-react';
import { Input } from '@/app/components/forms/Input';
import { Select, Option } from '@/app/components/forms/Select';
import { checkoutSchema, type CheckoutInput, type TravellerInput } from '@/app/actions/quote/checkout-schema';
import TravellerModal, { isTravellerComplete } from './TravellerModal';
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

const EMPTY_DIGITS = (): string[] => ['', '', '', '', '', ''];

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

export default function CheckoutForm({ pax, onChange }: { pax: Pax; onChange: (v: CheckoutInput | null) => void }) {
    const [travellers, setTravellers]     = useState<TravellerInput[]>(() => initialTravellers(pax));
    const [email, setEmail]               = useState('');
    const [countryCode, setCountryCode]   = useState('+91');
    const [phoneInput, setPhoneInput]     = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [gst, setGst]                   = useState('');
    const [touched, setTouched]           = useState<Record<string, boolean>>({});
    const [phoneError, setPhoneError]     = useState('');

    // OTP dialog
    const [otpOpen, setOtpOpen]         = useState(false);
    const [otpDigits, setOtpDigits]     = useState<string[]>(EMPTY_DIGITS());
    const [otpSending, setOtpSending]   = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [otpError, setOtpError]       = useState('');

    const otpRefs         = useRef<(HTMLInputElement | null)[]>([]);
    const widgetReady     = useRef(false);
    const onVerifySuccess = useRef<((data: any) => void) | null>(null);
    const onVerifyFailure = useRef<((err: any) => void) | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTab, setModalTab]   = useState(0);
    const labels = useMemo(() => travellerLabels(travellers), [travellers]);

    const otp = otpDigits.join('');

    useEffect(() => {
        if (resendTimer <= 0) return;
        const id = setTimeout(() => setResendTimer(t => t - 1), 1000);
        return () => clearTimeout(id);
    }, [resendTimer]);

    // Phone contributes to form validity only when verified
    useEffect(() => {
        const phone = phoneVerified ? `${countryCode}${phoneInput}` : '';
        const parsed = checkoutSchema.safeParse({ travellers, contact: { email, phone }, gstStateCode: gst });
        onChange(parsed.success ? parsed.data : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [travellers, email, phoneInput, phoneVerified, countryCode, gst]);

    const markTouched = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
    const emailErr = touched.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email.' : undefined;

    function validatePhone(): boolean {
        if (!phoneInput) { setPhoneError('Enter your mobile number.'); return false; }
        const rule = PHONE_RULES[countryCode as CountryCode];
        if (rule && !rule.pattern.test(phoneInput)) {
            setPhoneError(`Enter a valid ${rule.label} number (${rule.length} digits).`);
            return false;
        }
        setPhoneError('');
        return true;
    }

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

        // Script already injected (possibly by login modal) — poll until ready
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

    function handleSendOtp() {
        if (!validatePhone()) return;
        setOtpSending(true);
        setOtpError('');

        initWidget(() => {
            const win = window as any;
            if (!win.sendOtp) { setOtpError('OTP service not ready. Please refresh.'); setOtpSending(false); return; }
            win.sendOtp(`${countryCode.replace('+', '')}${phoneInput}`);
            setOtpDigits(EMPTY_DIGITS());
            setOtpOpen(true);
            setResendTimer(30);
            setOtpSending(false);
        });
    }

    function handleVerifyOtp() {
        if (otp.length !== 6) { setOtpError('Enter the 6-digit OTP.'); return; }
        const win = window as any;
        if (!win.verifyOtp) { setOtpError('OTP service not ready. Please refresh.'); return; }

        setOtpVerifying(true);
        setOtpError('');

        onVerifySuccess.current = () => {
            setPhoneVerified(true);
            setOtpOpen(false);
            setOtpVerifying(false);
        };
        onVerifyFailure.current = (err: any) => {
            setOtpError(err?.message ?? 'Invalid OTP. Please try again.');
            setOtpVerifying(false);
        };
        win.verifyOtp(otp);
    }

    function handleResend() {
        const win = window as any;
        if (!win.sendOtp) { setOtpError('OTP service not ready. Please refresh.'); return; }
        setOtpDigits(EMPTY_DIGITS());
        setOtpError('');
        win.sendOtp(`${countryCode.replace('+', '')}${phoneInput}`);
        setResendTimer(30);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
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
        } else if (e.key === 'ArrowLeft' && index > 0) { otpRefs.current[index - 1]?.focus(); }
        else if (e.key === 'ArrowRight' && index < 5) { otpRefs.current[index + 1]?.focus(); }
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

    return (
        <div className="flex flex-col gap-5">
            {/* Traveller slots */}
            <div className="rounded-xl border border-(--border-muted) divide-y divide-(--border-muted)">
                {travellers.map((t, i) => {
                    const done = isTravellerComplete(t);
                    const name = `${t.firstName} ${t.lastName}`.trim();
                    return (
                        <button key={i} type="button" onClick={() => { setModalTab(i); setModalOpen(true); }}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50">
                            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-success-50 text-success-600' : 'bg-primary-50 text-primary-600'}`}>
                                {done ? <CheckCircleIcon weight="fill" className="size-5" /> : <PlusIcon weight="bold" className="size-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-(--text-primary)">{done ? name : `Add ${labels[i]}`}</span>
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
                        <Input type="email" placeholder="you@example.com" value={email}
                            onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched('email')} error={emailErr} />
                    </div>
                    <div>
                        <Label>Mobile number</Label>
                        {phoneVerified ? (
                            /* ── Verified state ── */
                            <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-green-200 bg-green-50">
                                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                                <span className="flex-1 text-sm text-neutral-700 font-medium">{countryCode} {phoneInput}</span>
                                <button type="button"
                                    onClick={() => { setPhoneVerified(false); setPhoneInput(''); setPhoneError(''); }}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-semibold shrink-0 cursor-pointer">
                                    Change
                                </button>
                            </div>
                        ) : (
                            /* ── Input state ── */
                            <div className="flex gap-2">
                                <Select value={countryCode}
                                    onChange={(v) => { setCountryCode(v); setPhoneVerified(false); if (phoneError) setPhoneError(''); }}
                                    maxHeight="sm" className="min-w-28 h-11">
                                    {COUNTRY_OPTIONS.map(({ code, flag, label }) => (
                                        <Option key={code} value={code}>{flag} {code}</Option>
                                    ))}
                                </Select>
                                <Input type="tel" placeholder="98765 43210" value={phoneInput}
                                    onChange={(e) => { setPhoneInput(e.target.value.replace(/\D/g, '')); setPhoneVerified(false); if (phoneError) setPhoneError(''); }}
                                    onBlur={() => markTouched('phone')}
                                    inputMode="numeric"
                                    maxLength={PHONE_RULES[countryCode as CountryCode]?.length ?? 15}
                                    error={phoneError}
                                    wrapperClassName="flex-1"
                                    rightIcon={
                                        <button type="button" onClick={handleSendOtp}
                                            disabled={otpSending || !phoneInput}
                                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap">
                                            {otpSending ? '…' : 'Verify'}
                                        </button>
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-3">
                    <Label>GST number / state <span className="font-normal text-(--text-muted)">(optional)</span></Label>
                    <Input placeholder="For a GST invoice" value={gst} onChange={(e) => setGst(e.target.value)} />
                </div>
            </div>

            <TravellerModal open={modalOpen} travellers={travellers} labels={labels} initialTab={modalTab}
                onClose={() => setModalOpen(false)} onSave={setTravellers} />

            {/* OTP verification dialog */}
            <Dialog open={otpOpen} onClose={() => setOtpOpen(false)} className="relative z-[500]">
                <DialogBackdrop transition
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200" />
                <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <DialogPanel transition
                        className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden
                            data-closed:translate-y-8 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 transition-all">

                        <div className="px-6 pt-7 pb-5 bg-linear-to-br from-primary-600 via-primary-500 to-primary-400">
                            <h2 className="text-xl font-bold text-white">Verify your number</h2>
                            <p className="text-white/70 text-sm mt-0.5">OTP sent to {countryCode} {phoneInput}</p>
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

                            {/* Resend + change number */}
                            <div className="flex items-center justify-between">
                                <button type="button"
                                    onClick={() => { setOtpOpen(false); setOtpDigits(EMPTY_DIGITS()); setResendTimer(0); setOtpError(''); }}
                                    className="text-sm text-neutral-500 hover:text-neutral-700 font-medium flex items-center gap-1 cursor-pointer transition-colors">
                                    <ArrowLeft size={14} /> Change number
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
                                disabled={otpVerifying || otp.length !== 6}
                                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed
                                    text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-primary-200">
                                {otpVerifying ? 'Verifying…' : 'Verify OTP'}
                            </button>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
        </div>
    );
}
