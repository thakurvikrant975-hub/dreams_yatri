'use client'

import { useEffect, useRef, useState } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/app/components/modals/Modal_Structure';
import Input from '@/app/components/forms/Input';
import Button from '@/app/components/ui/Button';
import { Select, Option } from '@/app/components/forms/Select';
import { Mail, MessageCircle, RotateCcw, ArrowLeft, CheckCircle } from 'lucide-react';

type ContactType = 'email' | 'whatsapp';
type Step = 'input' | 'pending' | 'success';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+1',  label: '🇺🇸 +1'  },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+971',label: '🇦🇪 +971'},
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+60', label: '🇲🇾 +60' },
];

const EMPTY_DIGITS = (): string[] => ['', '', '', '', '', ''];

interface Props {
  open:         boolean;
  onClose:      () => void;
  type:         ContactType;
  currentValue: string | null;
  onSuccess:    () => void;
}

export function ChangeContactModal({ open, onClose, type, currentValue, onSuccess }: Props) {
  const [step,         setStep]         = useState<Step>('input');
  const [value,        setValue]        = useState('');
  const [countryCode,  setCountryCode]  = useState('+91');
  const [otpDigits,    setOtpDigits]    = useState<string[]>(EMPTY_DIGITS());
  const [waToken,      setWaToken]      = useState('');
  const [resendTimer,  setResendTimer]  = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setValue('');
      setCountryCode('+91');
      setOtpDigits(EMPTY_DIGITS());
      setWaToken('');
      setResendTimer(0);
      setLoading(false);
      setError('');
    }
  }, [open]);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  // Auto-close after success
  useEffect(() => {
    if (step !== 'success') return;
    const id = setTimeout(() => { onSuccess(); }, 1500);
    return () => clearTimeout(id);
  }, [step, onSuccess]);

  // ── OTP input handlers ─────────────────────────────────────────────────────
  function handleOtpChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...otpDigits];
    next[i] = digit;
    setOtpDigits(next);
    if (error) setError('');
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otpDigits[i]) {
        const next = [...otpDigits]; next[i] = ''; setOtpDigits(next);
      } else if (i > 0) { otpRefs.current[i - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft'  && i > 0) otpRefs.current[i - 1]?.focus();
    else if   (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const next = [...otpDigits];
    for (let i = 0; i < paste.length; i++) next[i] = paste[i];
    setOtpDigits(next);
    otpRefs.current[Math.min(paste.length, 5)]?.focus();
  }

  // ── Send / Resend ─────────────────────────────────────────────────────────
  async function handleSend() {
    setError('');
    setLoading(true);

    try {
      if (type === 'email') {
        const res  = await fetch('/api/user/contact/email', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: value.trim() }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Something went wrong.'); return; }
        setStep('pending');
        setResendTimer(30);

      } else {
        const phone = `${countryCode}${value.trim()}`;
        const res   = await fetch('/api/user/contact/whatsapp', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ phone }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Something went wrong.'); return; }
        setWaToken(json.data?.token ?? '');
        setStep('pending');
        setResendTimer(30);
        setOtpDigits(EMPTY_DIGITS());
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtpDigits(EMPTY_DIGITS());
    setError('');
    await handleSend();
  }

  // ── Verify WhatsApp OTP ───────────────────────────────────────────────────
  async function handleVerifyOtp() {
    const otp = otpDigits.join('');
    if (otp.length !== 6) { setError('Enter all 6 digits.'); return; }

    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/user/contact/whatsapp/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: waToken, otp }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Verification failed.');
        if (res.status === 410 || res.status === 429) {
          setStep('input');
          setOtpDigits(EMPTY_DIGITS());
        }
        return;
      }
      setStep('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const isEmail    = type === 'email';
  const title      = isEmail ? (currentValue ? 'Change Email Address' : 'Add Email Address')
                             : (currentValue ? 'Change WhatsApp Number' : 'Add WhatsApp Number');

  return (
    <Modal open={open} onClose={onClose} maxWidth="sm">
      <ModalHeader onClose={onClose}>{title}</ModalHeader>

      <ModalBody>
        {/* ── Success ── */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="font-semibold text-neutral-800">
              {isEmail ? 'Email updated!' : 'WhatsApp number saved!'}
            </p>
          </div>
        )}

        {/* ── Email — input step ── */}
        {step === 'input' && isEmail && (
          <div className="space-y-4">
            {currentValue && (
              <p className="text-sm text-neutral-500">
                Current: <span className="font-medium text-neutral-700">{currentValue}</span>
              </p>
            )}
            <div>
              <label htmlFor="cc-email" className="block text-sm font-medium text-neutral-700 mb-1.5">New Email Address</label>
              <Input
                id="cc-email"
                type="email"
                value={value}
                onChange={e => { setValue(e.target.value); setError(''); }}
                placeholder="you@example.com"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>
        )}

        {/* ── WhatsApp — input step ── */}
        {step === 'input' && !isEmail && (
          <div className="space-y-4">
            {currentValue && (
              <p className="text-sm text-neutral-500">
                Current: <span className="font-medium text-neutral-700">{currentValue}</span>
              </p>
            )}
            <div>
              <label htmlFor="cc-wa" className="block text-sm font-medium text-neutral-700 mb-1.5">WhatsApp Number</label>
              <div className="flex gap-2">
                <Select value={countryCode} onChange={setCountryCode} className="min-w-28 h-11">
                  {COUNTRY_CODES.map(c => (
                    <Option key={c.code} value={c.code}>{c.label}</Option>
                  ))}
                </Select>
                <Input
                  id="cc-wa"
                  type="tel"
                  inputMode="numeric"
                  value={value}
                  onChange={e => { setValue(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="Phone number"
                  wrapperClassName="flex-1"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>
        )}

        {/* ── Email — pending (check inbox) step ── */}
        {step === 'pending' && isEmail && (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto">
              <Mail size={24} className="text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-neutral-800">Check your inbox</p>
              <p className="text-sm text-neutral-500 mt-1">
                We sent a verification link to <strong>{value}</strong>
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                Click the link in the email to confirm your new address. It expires in 10 minutes.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => { setStep('input'); setError(''); }}
                className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} /> Use a different email
              </button>

              {resendTimer > 0 ? (
                <span className="text-sm text-neutral-400 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-500 tabular-nums">
                    {resendTimer}
                  </span>
                  Resend in {resendTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={13} /> Resend
                </button>
              )}
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>
        )}

        {/* ── WhatsApp — OTP step ── */}
        {step === 'pending' && !isEmail && (
          <div className="space-y-5">
            <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                <MessageCircle size={14} className="text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-800">OTP sent to WhatsApp</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Code sent to <strong>{countryCode} {value}</strong>
                </p>
              </div>
            </div>

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
                    className={`w-10 h-12 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-150
                      ${error
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : otpDigits[i]
                          ? 'border-neutral-800 bg-white text-neutral-900'
                          : 'border-neutral-200 bg-white text-neutral-800 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100'
                      }`}
                  />
                ))}
              </div>
              {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStep('input'); setOtpDigits(EMPTY_DIGITS()); setError(''); }}
                className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} /> Change number
              </button>

              {resendTimer > 0 ? (
                <span className="text-sm text-neutral-400 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-500 tabular-nums">
                    {resendTimer}
                  </span>
                  Resend in {resendTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={13} /> Resend OTP
                </button>
              )}
            </div>
          </div>
        )}
      </ModalBody>

      {/* Footer — only for actionable steps */}
      {step !== 'success' && (
        <ModalFooter>
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>

            {step === 'input' && (
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !value.trim()}
                className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer shadow-sm shadow-primary-200"
              >
                {loading ? 'Sending…' : 'Send Verification'}
              </button>
            )}

            {step === 'pending' && !isEmail && (
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otpDigits.join('').length !== 6}
                className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer shadow-sm shadow-primary-200"
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            )}
          </div>
        </ModalFooter>
      )}
    </Modal>
  );
}
