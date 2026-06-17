// EnquiryForm.tsx
'use client'
import React, { useState } from 'react';
import Input from '@/app/components/forms/Input';
import Label from '@/app/components/forms/Label';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { useBooking } from '../PackageBookingProvider';
import { submitPackageEnquiry } from '@/app/actions/enquiry/submit';
import { enquirySchema, type EnquiryErrors } from '@/app/actions/enquiry/schema';
import { COUNTRY_CODES, DEFAULT_COUNTRY } from '@/app/lib/assets/country-codes';

type EnquiryFormProps = {
  packageName: string;
  destination?: string;
};

const EnquiryForm: React.FC<EnquiryFormProps> = ({ packageName, destination }) => {
  const { pricing, adults, childCount, infants } = useBooking();

  const [formData, setFormData] = useState({ name: '', email: '', countryCode: DEFAULT_COUNTRY.code, mobileNumber: '' });
  const [errors,   setErrors]   = useState<EnquiryErrors>({});
  const [formError, setFormError] = useState('');
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'success'>('idle');

  const totalPax = adults + childCount + infants;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const validateField = (field: keyof EnquiryErrors, value: string) => {
    const shape = enquirySchema.shape[field as 'name' | 'email' | 'phone'];
    if (!shape) return;
    const result = shape.safeParse(value);
    setErrors(prev => ({
      ...prev,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dial = COUNTRY_CODES.find(c => c.code === formData.countryCode)?.dial ?? DEFAULT_COUNTRY.dial;
    const phone = dial + formData.mobileNumber;
    const parsed = enquirySchema.safeParse({ name: formData.name, email: formData.email, phone, packageName });
    if (!parsed.success) {
      const fe: EnquiryErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof EnquiryErrors;
        if (key && !fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setStatus('loading');
    setFormError('');

    const result = await submitPackageEnquiry({
      name:  formData.name,
      email: formData.email,
      phone,
      packageName,
      destination,
      packageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
      pageUrl:    typeof window !== 'undefined' ? window.location.href     : undefined,
    });

    if (result.ok) {
      setStatus('success');
      setFormData({ name: '', email: '', countryCode: DEFAULT_COUNTRY.code, mobileNumber: '' });
      setErrors({});
    } else if ('fieldErrors' in result && result.fieldErrors) {
      setErrors(result.fieldErrors);
      setStatus('idle');
    } else if ('formError' in result && result.formError) {
      setFormError(result.formError);
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <Card className="px-6 py-5 flex flex-col items-center text-center gap-2">
        <div className="size-12 rounded-full bg-success-50 flex items-center justify-center mb-1">
          <svg className="size-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <Heading level={3} weight="semibold">Enquiry Sent!</Heading>
        <Text size="sm" intent="secondary">We'll get back to you shortly.</Text>
        <button
          onClick={() => setStatus('idle')}
          className="mt-2 text-xs text-brand underline underline-offset-2"
        >
          Send another
        </button>
      </Card>
    );
  }

  return (
    <Card className='px-6 py-5'>
      <Heading level={3} weight='semibold'>Send Enquiry</Heading>
      <Text size='sm' intent='secondary' truncate={true} className='mt-0.5'>{packageName}</Text>
      {pricing && (
        <div className="flex items-center gap-2 mb-4 mt-1">
          <Text as='span' size='base' intent='primary' weight='bold'>{fmt(pricing.finalPrice)}</Text>
          <Text as='span' size='xs' intent='muted'>for {totalPax} traveller{totalPax !== 1 ? 's' : ''}</Text>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-3">

          <div>
            <Label htmlFor="enquiry-name" required>Full Name</Label>
            <Input
              id="enquiry-name"
              placeholder="Your name"
              value={formData.name}
              error={errors.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              onBlur={e => validateField('name', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="enquiry-email">Email</Label>
            <Input
              id="enquiry-email"
              type="email"
              placeholder="example@email.com"
              value={formData.email}
              error={errors.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              onBlur={e => validateField('email', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="enquiry-phone" required>Phone No.</Label>
            <div className="flex gap-2">
              <select
                value={formData.countryCode}
                onChange={e => setFormData(p => ({ ...p, countryCode: e.target.value }))}
                className="h-11 w-24 shrink-0 rounded-xl bg-white px-2 text-sm font-medium text-(--text-primary) cursor-pointer ring-[0.09em] ring-inset ring-neutral-400/80 outline-none hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400"
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <Input
                id="enquiry-phone"
                type="tel"
                inputMode="numeric"
                placeholder="Mobile number"
                value={formData.mobileNumber}
                error={errors.phone}
                wrapperClassName="flex-1"
                onChange={e => setFormData(p => ({ ...p, mobileNumber: e.target.value.replace(/\D/g, '') }))}
                onBlur={() => {
                  const dial = COUNTRY_CODES.find(c => c.code === formData.countryCode)?.dial ?? DEFAULT_COUNTRY.dial;
                  validateField('phone', dial + formData.mobileNumber);
                }}
              />
            </div>
          </div>

        </div>

        {formError && (
          <p className="text-xs text-error-500 mt-3 text-center">{formError}</p>
        )}

        <Button
          variant="primary"
          className="w-full mt-4"
          type="submit"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </Card>
  );
};

export default EnquiryForm;
