// PricingCard.tsx
'use client'
import React from 'react';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';
import SavingsBadge from '@/app/components/packages/SavingBadge';

type PricingCardProps = {
  originalPrice:   number;
  discountedPrice: number;
  savings:         number;
  packageName:     string;
  className?:      string;
};

const PricingCard: React.FC<PricingCardProps> = ({
  originalPrice,
  discountedPrice,
  savings,
  className,
}) => {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <Card className='px-6 py-5'>
      <div className="flex items-center gap-4 mb-1.5">
        <Text size='sm' intent='muted' weight='medium' className='relative after:absolute after:w-full after:h-px after:bg-error-500 after:top-1/2 after:left-0 px-0.5'>
          {fmt(originalPrice)}
        </Text>
        <SavingsBadge amount={`₹${savings.toLocaleString('en-IN')}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <Text as='span' size='2xl' weight='bold' intent='primary' className="font-heading tracking-tight text-primary">
          {fmt(discountedPrice)}
        </Text>
        <Text as='span' size='sm' intent='secondary' className='font-heading'>/Adults</Text>
      </div>
      <Text size='xs' intent='secondary' className='mt-2'>Excluding applicable taxes</Text>
      <Button variant="premium" className="w-full mt-4">
        Book this package
      </Button>
      <Button variant="outline" className="w-full mt-4">
        Book a call
      </Button>
    </Card>
  );
};

export default PricingCard;