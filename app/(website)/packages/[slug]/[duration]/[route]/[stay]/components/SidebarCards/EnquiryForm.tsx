// EnquiryForm.tsx
'use client'
import React, { useState } from 'react';
import Input from '@/app/components/forms/Input';
import Label from '@/app/components/forms/Label';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { useBooking } from '../PackageBookingProvider';

type EnquiryFormProps = {
  packageName: string;
};

const EnquiryForm: React.FC<EnquiryFormProps> = ({ packageName }) => {
  const { pricing, adults, childCount, infants } = useBooking();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const totalPax = adults + childCount + infants;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

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
      <div className="flex flex-col gap-3">
        <div>
          <Label required>Full Name</Label>
          <Input
            placeholder="Your name"
            value={formData.name}
            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <Label required>Email</Label>
          <Input
            type="email"
            placeholder="example@email.com"
            value={formData.email}
            onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div>
          <Label required>Phone No.</Label>
          <Input
            type="tel"
            placeholder="+91 8219986345"
            value={formData.phone}
            onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
          />
        </div>
      </div>
      <Button variant="primary" className="w-full mt-4">
        Send
      </Button>
    </Card>
  );
};

export default EnquiryForm;