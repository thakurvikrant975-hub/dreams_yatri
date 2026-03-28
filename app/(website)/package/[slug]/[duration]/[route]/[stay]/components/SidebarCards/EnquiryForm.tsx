// EnquiryForm.tsx
'use client'
import React, { useState } from 'react';
import Input from '@/app/components/forms/Input';
import Label from '@/app/components/forms/Label';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';

type EnquiryFormProps = {
  discountedPrice: number;
  savings:         number;
  packageName:     string;
};

const EnquiryForm: React.FC<EnquiryFormProps> = ({
  discountedPrice,
  savings,
  packageName,
}) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <Card className='px-6 py-5'>
      <Heading level={3} weight='semibold'>Send Enquiry</Heading>
      <Text size='sm' intent='secondary' truncate={true} className='mt-0.5'>{packageName}</Text>
      <div className="flex items-center gap-2 mb-4 mt-1">
        <Text as='span' size='base' intent='primary' weight='bold'>{fmt(discountedPrice)}</Text>
        <Text as='span' size='xs' weight='medium' className="text-success-700">Save {fmt(savings)}</Text>
      </div>
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