'use client'
import { useState } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal_Structure';
import { useModal } from '@/app/hooks/useModals';
import Input from '../forms/Input';
import Label from '../forms/Label';
import Button from '../ui/Button';
import { Select, Option } from '../forms/Select';
import { phoneLoginSchema, emailLoginSchema, PHONE_RULES, type CountryCode } from '@/app/lib/validators/login';
import { handleApiError } from '@/app/lib/api-error';
import { z } from 'zod'
import { signIn } from 'next-auth/react';

// ─── Country Codes ─────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'IN' },
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'AU' },
  { code: '+971', flag: '🇦🇪', label: 'AE' },
  { code: '+65', flag: '🇸🇬', label: 'SG' },
  { code: '+60', flag: '🇲🇾', label: 'MY' },
];

// ─── Divider ───────────────────────────────────────────────────────────────────

function Divider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <hr className="flex-1 border-neutral-200" />
      <span className="text-xs text-[--text-muted] font-medium">{label}</span>
      <hr className="flex-1 border-neutral-200" />
    </div>
  );
}

// ─── Google Icon ───────────────────────────────────────────────────────────────

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

// ─── Main Component ────────────────────────────────────────────────────────────

type LoginMethod = 'phone' | 'email';

function LoginModal() {
  const { isOpen, type, closeModal } = useModal();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [countryCode, setCountryCode] = useState('+91');
  const [activeMethod, setActiveMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  function clearErrorIfValid(field: string, schema: z.ZodType, value: unknown) {
    if (!errors[field]) return; // no error showing — skip parse cost
    const result = schema.safeParse(value);
    if (result.success) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setPhone(val);
    clearErrorIfValid('phone', phoneLoginSchema, { countryCode, phone: val });
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEmail(val);
    clearErrorIfValid('email', emailLoginSchema, { email: val });
  }

  function handleCountryCodeChange(val: string) {
  setCountryCode(val);
  if (errors.phone) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.phone;
      return next;
    });
  }
}

  function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();
    const result = activeMethod === 'phone'
      ? phoneLoginSchema.safeParse({ countryCode, phone })
      : emailLoginSchema.safeParse({ email });

    if (!result.success) {
      const fieldErrors = result.error.issues.reduce((acc, issue) => {
        const key = issue.path[0] as string;
        acc[key] = issue.message;
        return acc;
      }, {} as Record<string, string>);

      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    // proceed → OTP / magic link call
  }



  if (!isOpen || type !== 'login-modal') return null;

  return (
    <Modal
      as='form'
      open={isOpen}
      onClose={closeModal}
      data-layout="website"
      onSubmit={handleSubmit}
    >

      <ModalHeader onClose={closeModal}>Log In</ModalHeader>

      <ModalBody className="space-y-1 min-h-100">

        {/* ── Method Toggle ── */}
        <div className="flex rounded-xl bg-surface-muted p-1 gap-1 mb-4">
          {(['phone', 'email'] as LoginMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setActiveMethod(method)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg capitalize transition-all
                ${activeMethod === method
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-[--text-muted] hover:text-primary'
                }`}
            >
              {method === 'phone' ? 'Phone' : 'Email'}
            </button>
          ))}
        </div>

        {/* ── Phone Input ── */}
        {activeMethod === 'phone' && (
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2 mt-1">

              {/* Country Code Selector */}
              <Select
                value={countryCode}
                onChange={handleCountryCodeChange}
                maxHeight='sm'
                className='min-w-30 h-full max-h-11'
              >
                {COUNTRY_CODES.map(({ code, flag, label }) => (
                  <Option key={code} value={code}>
                    {flag} {code}
                  </Option>
                ))}
              </Select>

              <Input
                id="phone"
                type="tel"
                placeholder='Enter phone number'
                size="md"
                className="flex-1"
                value={phone}
                onChange={handlePhoneChange}
                inputMode="numeric"
                maxLength={PHONE_RULES[countryCode as CountryCode]?.length ?? 15}
                wrapperClassName="w-full"
                error={errors.phone}
              />
            </div>
          </div>
        )}

        {/* ── Email Input ── */}
        {activeMethod === 'email' && (
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              size="md"
              className="mt-1"
              value={email}
              onChange={handleEmailChange}
              error={errors.email}
            />
          </div>
        )}

        {/* ── Divider ── */}
        <Divider label="or continue with" />

        {/* ── Google SSO ── */}
        <Button
          type="button"
          variant="outline"
          size="md"
          className='w-full'
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}        >
          <GoogleIcon />
          Continue with Google
        </Button>

        {/* ── Terms ── */}
        <p className="text-[11px] text-center text-[--text-muted] pt-2">
          By continuing, you agree to our{' '}
          <a href="/terms" className="underline hover:text-primary">Terms</a>
          {' '}and{' '}
          <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a>.
        </p>

      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-end gap-3">
          <Button type="button" onClick={closeModal} variant="outline" size="sm">
            Cancel
          </Button>
          <Button type='submit' size="sm">
            {activeMethod === 'phone' ? 'Send OTP' : 'Continue'}
          </Button>
        </div>
      </ModalFooter>

    </Modal>
  );
}

export default LoginModal;