'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { useModal } from '@/app/hooks/useModals';
import Input from '../forms/Input';
import { Select, Option } from '../forms/Select';
import { phoneLoginSchema, emailLoginSchema, PHONE_RULES, type CountryCode } from '@/app/lib/validators/login';
import { sendOtp as msg91Send, verifyOtp as msg91Verify, preloadOtpWidget } from '@/app/lib/msg91';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import axios from 'axios';
import { X, Phone, Mail, ArrowLeft, RotateCcw } from 'lucide-react';
import { AirplaneIcon } from '@phosphor-icons/react';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'IN' },
  { code: '+1',  flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'AU' },
  { code: '+971',flag: '🇦🇪', label: 'AE' },
  { code: '+65', flag: '🇸🇬', label: 'SG' },
  { code: '+60', flag: '🇲🇾', label: 'MY' },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

type LoginMethod = 'phone' | 'email';

const EMPTY_DIGITS = (): string[] => ['', '', '', '', '', ''];

function LoginModal() {
  const { isOpen, type, data, closeModal } = useModal();
  const modalData = data as { redirectTo?: string; phone?: string; countryCode?: string } | null;
  const redirectTo = modalData?.redirectTo ?? '/profile';
  // Callers mid-flow (e.g. checkout) already collected a mobile number — pass
  // it in and the modal skips straight to OTP entry for that number instead of
  // asking for it a second time.
  const prefillPhone = modalData?.phone ?? '';
  const prefillCountryCode = modalData?.countryCode ?? '+91';
  const router = useRouter();
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [countryCode, setCountryCode] = useState('+91');
  const [activeMethod, setActiveMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone]   = useState('');
  const [email, setEmail]   = useState('');
  const [sent, setSent]       = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(EMPTY_DIGITS());
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  const otp = otpDigits.join('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Warms the MSG91 widget script as soon as this component mounts (it's
  // always mounted globally via ModalRoot, well before a user opens the
  // modal) — so the first real "Send OTP" click doesn't race an in-flight
  // script fetch and silently no-op while the UI optimistically shows
  // "OTP sent" (see msg91Send below, which now waits for onSent anyway).
  useEffect(() => {
    preloadOtpWidget();
  }, []);

  useEffect(() => {
    if (!otpSent) return;
    setResendTimer(30);
  }, [otpSent]);

  // Auto-send the OTP when a caller opened the modal with a known number.
  // Guarded by a ref so a re-render (or the resend timer ticking) can't fire a
  // second SMS for the same modal opening.
  const autoSentForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || type !== 'login-modal') { autoSentForRef.current = null; return; }
    if (!prefillPhone) return;

    const key = `${prefillCountryCode}${prefillPhone}`;
    if (autoSentForRef.current === key) return;
    autoSentForRef.current = key;

    setActiveMethod('phone');
    setCountryCode(prefillCountryCode);
    setPhone(prefillPhone);
    setLoading(true);
    msg91Send(
      `${prefillCountryCode.replace('+', '')}${prefillPhone}`,
      () => { setOtpSent(true); setLoading(false); setTimeout(() => otpRefs.current[0]?.focus(), 50); },
      () => { setLoading(false); },
      // If the auto-send fails, fall back to the normal number-entry step
      // (pre-filled) rather than stranding the user on an OTP box.
      (msg) => { setOtpSent(false); setErrors({ phone: msg }); setLoading(false); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type, prefillPhone, prefillCountryCode]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  function clearErrorIfValid(field: string, schema: z.ZodType, value: unknown) {
    if (!errors[field]) return;
    if (schema.safeParse(value).success)
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (errors.otp) setErrors(p => { const n = { ...p }; delete n.otp; return n; });
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < paste.length; i++) newDigits[i] = paste[i];
    setOtpDigits(newDigits);
    otpRefs.current[Math.min(paste.length, 5)]?.focus();
    if (errors.otp) setErrors(p => { const n = { ...p }; delete n.otp; return n; });
  }

  function handleResend() {
    setOtpDigits(EMPTY_DIGITS());
    setErrors({});
    msg91Send(
      `${countryCode.replace('+', '')}${phone}`,
      () => {
        setResendTimer(30);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      },
      () => {},
      (msg) => setErrors({ otp: msg }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = activeMethod === 'phone'
      ? phoneLoginSchema.safeParse({ countryCode, phone })
      : emailLoginSchema.safeParse({ email });

    if (!result.success) {
      setErrors(result.error.issues.reduce((acc, i) => ({ ...acc, [i.path[0] as string]: i.message }), {} as Record<string, string>));
      return;
    }

    setErrors({});
    setLoading(true);

    if (activeMethod === 'email') {
      try {
        await axios.post('/api/auth/send-otp', { email });
        setSent(true);
      } catch (err: any) {
        setErrors({ email: err.response?.data?.error || 'Something went wrong.' });
      } finally { setLoading(false); }
      return;
    }

    if (activeMethod === 'phone') {
      if (otpSent) {
        if (!otp || otp.length !== 6) { setErrors({ otp: 'Enter the 6-digit OTP.' }); setLoading(false); return; }
        msg91Verify(
          otp,
          async (data: any) => {
            const token = data?.message ?? data?.access_token ?? data?.token ?? data;
            const res = await signIn('credentials', {
              redirect: false,
              msg91Token: typeof token === 'string' ? token : JSON.stringify(token),
              phone: `${countryCode}${phone}`,
            });
            if (res?.error) { setErrors({ otp: 'Verification failed. Please try again.' }); }
            else {
              closeModal();
              const currentPath = window.location.pathname + window.location.search;
              if (redirectTo === currentPath) { router.refresh(); }
              else { window.location.href = redirectTo; }
            }
            setLoading(false);
          },
          (err: any) => { setErrors({ otp: err?.message ?? 'Invalid OTP. Please try again.' }); setLoading(false); },
          (msg: string) => { setErrors({ otp: msg }); setLoading(false); },
        );
        return;
      }

      msg91Send(
        `${countryCode.replace('+', '')}${phone}`,
        () => { setOtpSent(true); setLoading(false); },
        () => { setLoading(false); },
        (msg) => { setErrors({ phone: msg }); setLoading(false); },
      );
    }
  }

  if (!isOpen || type !== 'login-modal') return null;

  return (
    <Dialog open={isOpen} onClose={closeModal} className="relative z-500">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200"
      />

      <div className="fixed inset-0 z-10 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel
          transition
          className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden
            data-closed:translate-y-8 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 transition-all"
        >
          {/* ── Branded header ─────────────────────────────────────────────── */}
          <div className="relative px-6 pt-8 pb-6 bg-linear-to-br from-primary-600 via-primary-500 to-primary-400 overflow-hidden">
            {/* decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/10" />

            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors"
            >
              <X className='cursor-pointer' size={16} />
            </button>

            <h2 className="relative text-2xl font-bold text-white">Welcome back</h2>
            <p className="relative text-white/70 text-sm mt-1">Sign in to continue your journey</p>
          </div>

          {/* ── Form body ──────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} noValidate className="px-6 py-6 space-y-5">

            {/* Method toggle */}
            <div className="flex bg-neutral-100 rounded-xl p-1 gap-1">
              {(['phone', 'email'] as LoginMethod[]).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => { setActiveMethod(method); setSent(false); setOtpSent(false); setOtpDigits(EMPTY_DIGITS()); setResendTimer(0); setErrors({}); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer
                    ${activeMethod === method
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                >
                  {method === 'phone'
                    ? <><Phone size={14} /> Phone</>
                    : <><Mail size={14} /> Email</>
                  }
                </button>
              ))}
            </div>

            {/* ── Email sent state ── */}
            {activeMethod === 'email' && sent ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <Mail size={24} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-800">Check your inbox</p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Magic link sent to <strong>{email}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mx-auto cursor-pointer"
                >
                  <ArrowLeft size={14} /> Use a different email
                </button>
              </div>
            ) : (
              <>
                {/* Phone step 1 — enter number */}
                {activeMethod === 'phone' && !otpSent && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">Phone Number</label>
                    <div className="flex gap-2">
                      <Select
                        value={countryCode}
                        onChange={val => { setCountryCode(val); if (errors.phone) setErrors(p => { const n = {...p}; delete n.phone; return n; }); }}
                        maxHeight="sm"
                        className="min-w-28 h-11"
                      >
                        {COUNTRY_CODES.map(({ code, flag, label }) => (
                          <Option key={code} value={code}>{flag} {code}</Option>
                        ))}
                      </Select>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter phone number"
                        size="md"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); clearErrorIfValid('phone', phoneLoginSchema, { countryCode, phone: e.target.value }); }}
                        inputMode="numeric"
                        maxLength={PHONE_RULES[countryCode as CountryCode]?.length ?? 15}
                        wrapperClassName="flex-1"
                        error={errors.phone}
                      />
                    </div>
                  </div>
                )}

                {/* Phone step 2 — OTP boxes */}
                {activeMethod === 'phone' && otpSent && (
                  <div className="space-y-5">
                    {/* Sent-to banner */}
                    <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Phone size={14} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-800">OTP sent successfully</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Enter the 6-digit code sent to <strong>{countryCode} {phone}</strong>
                        </p>
                      </div>
                    </div>

                    {/* 6-box OTP input */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-neutral-700 block text-center">Enter OTP</label>
                      <div className="flex items-center justify-center gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <input
                            key={i}
                            ref={el => { otpRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={otpDigits[i]}
                            autoFocus={i === 0}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            onPaste={handleOtpPaste}
                            onFocus={e => e.target.select()}
                            className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-150
                              ${errors.otp
                                ? 'border-red-400 bg-red-50 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                                : otpDigits[i]
                                  ? 'border-neutral-800 bg-white text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200'
                                  : 'border-neutral-200 bg-white text-neutral-800 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100'
                              }`}
                          />
                        ))}
                      </div>
                      {errors.otp && (
                        <p className="text-xs text-red-500 text-center font-medium">{errors.otp}</p>
                      )}
                    </div>

                    {/* Resend + back */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpDigits(EMPTY_DIGITS()); setResendTimer(0); setErrors({}); }}
                        className="text-sm text-neutral-500 hover:text-neutral-700 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ArrowLeft size={14} /> Change number
                      </button>

                      {resendTimer > 0 ? (
                        <span className="text-sm text-neutral-400 flex items-center gap-1.5">
                          
                          Resend in {resendTimer}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <RotateCcw size={13} /> Resend OTP
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Email input */}
                {activeMethod === 'email' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">Email Address</label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      size="md"
                      value={email}
                      onChange={e => { setEmail(e.target.value); clearErrorIfValid('email', emailLoginSchema, { email: e.target.value }); }}
                      error={errors.email}
                    />
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <hr className="flex-1 border-neutral-200" />
                  <span className="text-xs text-neutral-400 font-medium">or</span>
                  <hr className="flex-1 border-neutral-200" />
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: redirectTo })}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-neutral-200 rounded-xl
                    bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-medium transition-colors cursor-pointer shadow-sm"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <p className="text-[11px] text-center text-neutral-400">
                  By continuing, you agree to our{' '}
                  <a href="/terms" className="underline hover:text-primary-600">Terms</a>
                  {' '}and{' '}
                  <a href="/privacy-policy" className="underline hover:text-primary-600">Privacy Policy</a>.
                </p>
              </>
            )}

            {/* Submit */}
            {!sent && (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed
                  text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-primary-200"
              >
                {loading
                  ? 'Please wait…'
                  : activeMethod === 'phone'
                    ? otpSent ? 'Verify OTP' : 'Send OTP'
                    : 'Send Magic Link'
                }
              </button>
            )}

          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default LoginModal;
