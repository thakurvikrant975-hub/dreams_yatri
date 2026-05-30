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

type EnquiryFormProps = {
  packageName: string;
};

const EnquiryForm: React.FC<EnquiryFormProps> = ({ packageName }) => {
  const { pricing, adults, childCount, infants } = useBooking();

  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [errors,   setErrors]   = useState<EnquiryErrors>({});
  const [formError, setFormError] = useState('');
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'success'>('idle');

  const totalPax = adults + childCount + infants;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // Validate a single field on blur and update errors
  const validateField = (field: keyof typeof formData, value: string) => {
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

    // Full client-side validation before hitting the server
    const parsed = enquirySchema.safeParse({ ...formData, packageName });
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
      ...formData,
      packageName,
      packageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
      pageUrl:    typeof window !== 'undefined' ? window.location.href     : undefined,
    });

    if (result.ok) {
      setStatus('success');
      setFormData({ name: '', email: '', phone: '' });
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
            <Label required>Full Name</Label>
            <Input
              placeholder="Your name"
              value={formData.name}
              error={errors.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              onBlur={e => validateField('name', e.target.value)}
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="example@email.com"
              value={formData.email}
              error={errors.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              onBlur={e => validateField('email', e.target.value)}
            />
          </div>

          <div>
            <Label required>Phone No.</Label>
            <Input
              type="tel"
              placeholder="+91 8219986345"
              value={formData.phone}
              error={errors.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              onBlur={e => validateField('phone', e.target.value)}
            />
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
