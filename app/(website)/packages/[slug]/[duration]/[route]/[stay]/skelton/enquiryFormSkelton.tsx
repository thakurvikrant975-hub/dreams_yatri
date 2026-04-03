// EnquiryForm.tsx
'use client'
import React, { useState } from 'react';
import Input from '@/app/components/forms/Input';
import Label from '@/app/components/forms/Label';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { Skeleton } from '@/app/components/skeltons/rawShimmer';


const EnquiryFormSkeleton = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });



  return (
    <Card className='px-6 py-5'>
      <Heading level={3} weight='semibold'>Send Enquiry</Heading>
      <Skeleton className="h-5 w-full mt-0.5 rounded-pill" />
      <div className="flex items-center gap-2 mb-4 mt-1">
        <Skeleton className="h-6 w-2/3 rounded-pill" />
      </div>
      <div className="flex flex-col gap-3 opacity-50 pointer-events-none">
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
      <Button variant="primary" className="w-full mt-4 opacity-50 pointer-events-none">
        Send
      </Button>
    </Card>
  );
};

export default EnquiryFormSkeleton;