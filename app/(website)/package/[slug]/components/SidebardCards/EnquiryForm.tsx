'use client'
import React, { useState } from 'react';
import Input from '@/app/components/forms/Input'
import Label from '@/app/components/forms/Label';
import Button from '@/app/components/ui/Button';


const EnquiryForm: React.FC<EnquiryFormProps> = ({
  discountedPrice,
  savings,
  packageName,
}) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const fmt = (n: number) =>
    `₹${n.toLocaleString('en-IN')}`;

  return (
      <div className="bg-surface rounded-2xl border border-neutral-200 p-5">
        <h3 className="text-base font-semibold text-primary mb-1">Send Enquiry</h3>
        <p className="text-sm text-secondary truncate mb-0.5">{packageName}</p>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-primary">{fmt(discountedPrice)}</span>
          <span className="text-xs text-success-600 font-medium">Save {fmt(savings)}</span>
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

        <Button variant="primary" size="lg" className="w-full mt-4 rounded-xl">
          Send
        </Button>
      </div>
  );
};

export default EnquiryForm;