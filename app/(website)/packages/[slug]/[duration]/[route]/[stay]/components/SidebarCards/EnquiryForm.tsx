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
import { cn } from '@/app/lib/utils';

type EnquiryFormProps = {
  packageName: string;
  destination?: string;
  /** When true: strips Card wrapper + heading — use inside modals/popups */
  bare?: boolean;
};

const TODAY = new Date().toISOString().split('T')[0];

type FormErrors = EnquiryErrors & { travellers?: string; travelDate?: string; message?: string };

const EnquiryForm: React.FC<EnquiryFormProps> = ({ packageName, destination, bare = false }) => {
  const { pricing, adults, childCount, infants } = useBooking();

  const [formData, setFormData] = useState({
    name:         '',
    email:        '',
    countryCode:  DEFAULT_COUNTRY.code,
    mobileNumber: '',
    travelDate:   '',
    travellers:   '',
    message:      '',
  });
  const [errors,    setErrors]    = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [status,    setStatus]    = useState<'idle' | 'loading' | 'success'>('idle');

  const totalPax = adults + childCount + infants;
  const fmt      = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const validateField = (field: keyof FormErrors, value: string) => {
    const shape = (enquirySchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }>)[field];
    if (!shape) return;
    const result = shape.safeParse(value);
    setErrors(prev => ({ ...prev, [field]: result.success ? undefined : result.error?.issues[0]?.message }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dial  = COUNTRY_CODES.find(c => c.code === formData.countryCode)?.dial ?? DEFAULT_COUNTRY.dial;
    const phone = dial + formData.mobileNumber;

    const newErrors: FormErrors = {};
    if (!formData.travelDate) newErrors.travelDate = 'Please select a travel date.';
    if (!formData.travellers || Number(formData.travellers) < 1) newErrors.travellers = 'At least 1 traveller.';

    const parsed = enquirySchema.safeParse({
      name: formData.name, email: formData.email, phone,
      countryCode: formData.countryCode,
      travelDate:  formData.travelDate  || undefined,
      travellers:  formData.travellers  ? Number(formData.travellers) : undefined,
      message:     formData.message     || undefined,
      packageName, destination,
    });

    if (!parsed.success) {
      const fe: FormErrors = { ...newErrors };
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormErrors;
        if (key && !fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setStatus('loading');
    setFormError('');

    const result = await submitPackageEnquiry({
      name: formData.name, email: formData.email, phone,
      countryCode: formData.countryCode,
      travelDate:  formData.travelDate  || undefined,
      travellers:  formData.travellers  ? Number(formData.travellers) : undefined,
      message:     formData.message     || undefined,
      packageName, destination,
      packageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
      pageUrl:    typeof window !== 'undefined' ? window.location.href     : undefined,
    });

    if (result.ok) {
      setStatus('success');
      setFormData({ name: '', email: '', countryCode: DEFAULT_COUNTRY.code, mobileNumber: '', travelDate: '', travellers: '', message: '' });
      setErrors({});
    } else if ('fieldErrors' in result && result.fieldErrors) {
      setErrors(result.fieldErrors as FormErrors);
      setStatus('idle');
    } else if ('formError' in result && result.formError) {
      setFormError(result.formError);
      setStatus('idle');
    }
  };

  const successNode = (
    <div className={cn('flex flex-col items-center text-center gap-2 py-6', !bare && 'px-6')}>
      <div className="size-14 rounded-full bg-success-50 flex items-center justify-center mb-1">
        <svg className="size-7 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <Heading level={3} weight="semibold">We&apos;ll be in touch!</Heading>
      <Text size="sm" intent="secondary">Our travel expert will call you within 24 hours.</Text>
      <button onClick={() => setStatus('idle')} className="mt-2 text-xs text-brand underline underline-offset-2">
        Send another
      </button>
    </div>
  );

  const formNode = (
    <div className={cn(!bare && 'px-6 py-5')}>
      {/* Header — only in sidebar Card mode */}
      {!bare && (
        <>
          <Heading level={3} weight="semibold">Connect with an Expert</Heading>
          <Text size="sm" intent="secondary" truncate className="mt-0.5">{packageName}</Text>
          {pricing && (
            <div className="flex items-center gap-2 mb-4 mt-1">
              <Text as="span" size="base" intent="primary" weight="bold">{fmt(pricing.finalPrice)}</Text>
              <Text as="span" size="xs" intent="muted">for {totalPax} traveller{totalPax !== 1 ? 's' : ''}</Text>
            </div>
          )}
        </>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-3">

          <div>
            <Label htmlFor="eq-name" required>Full Name</Label>
            <Input id="eq-name" placeholder="Your full name" value={formData.name} error={errors.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              onBlur={e => validateField('name', e.target.value)} />
          </div>

          <div>
            <Label htmlFor="eq-email">Email</Label>
            <Input id="eq-email" type="email" placeholder="example@email.com" value={formData.email} error={errors.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              onBlur={e => validateField('email', e.target.value)} />
          </div>

          <div>
            <Label htmlFor="eq-phone" required>Phone No.</Label>
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
              <Input id="eq-phone" type="tel" inputMode="numeric" placeholder="Mobile number"
                value={formData.mobileNumber} error={errors.phone} wrapperClassName="flex-1"
                onChange={e => setFormData(p => ({ ...p, mobileNumber: e.target.value.replace(/\D/g, '') }))}
                onBlur={() => {
                  const dial = COUNTRY_CODES.find(c => c.code === formData.countryCode)?.dial ?? DEFAULT_COUNTRY.dial;
                  validateField('phone', dial + formData.mobileNumber);
                }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="eq-date" required>Travel Date</Label>
              <Input id="eq-date" type="date" min={TODAY} value={formData.travelDate} error={errors.travelDate}
                onChange={e => { setFormData(p => ({ ...p, travelDate: e.target.value })); if (errors.travelDate) setErrors(p => ({ ...p, travelDate: undefined })); }} />
            </div>
            <div>
              <Label htmlFor="eq-travellers" required>Travellers</Label>
              <Input id="eq-travellers" type="number" inputMode="numeric" min={1} max={500} placeholder="2"
                value={formData.travellers} error={errors.travellers}
                onChange={e => { setFormData(p => ({ ...p, travellers: e.target.value })); if (errors.travellers) setErrors(p => ({ ...p, travellers: undefined })); }} />
            </div>
          </div>

          <div>
            <Label htmlFor="eq-message">Message</Label>
            <textarea id="eq-message" rows={3}
              placeholder="Any special requirements or questions…"
              value={formData.message} maxLength={1000}
              onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
              className="w-full rounded-xl font-medium outline-none border-none ring-[0.09em] ring-inset placeholder:text-neutral-400/60 placeholder:font-normal text-primary bg-white ring-neutral-400/80 hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400 px-3 py-2.5 text-sm resize-none"
            />
            {errors.message && <p role="alert" className="text-error-600 mt-1 text-xs font-medium">{errors.message}</p>}
          </div>

        </div>

        {formError && <p className="text-xs text-error-500 mt-3 text-center">{formError}</p>}

        <Button variant="primary" className="w-full mt-4" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Connect with an Expert'}
        </Button>
      </form>
    </div>
  );

  if (status === 'success') {
    return bare ? successNode : <Card>{successNode}</Card>;
  }

  return bare ? formNode : <Card>{formNode}</Card>;
};

export default EnquiryForm;
