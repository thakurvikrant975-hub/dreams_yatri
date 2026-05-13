'use client'
import React, { useState } from 'react';
import { cn } from '@/app/lib/utils';
import { Tag } from '@phosphor-icons/react';
import Card from '@/app/components/ui/Card';
import { Text, Heading } from '@/app/components/ui/Typography';

type Coupon = {
  code: string;
  discount: number;
  description?: string;
  applied?: boolean;
};

type CoupenCardProps = {
  coupons?: Coupon[];
};

const CoupenCard: React.FC<CoupenCardProps> = ({
    coupons = [],
}) => {

    return (
        <Card className='px-6 py-5'>
            <Heading level={3} weight='semibold'>Coupon &amp; Offer</Heading>
            <div className="flex items-center justify-between mb-3">
                <Text size='xs' intent='secondary'>Have Coupon Code?</Text>
                <button className="text-sm font-heading font-semibold text-primary-500 hover:text-primary-600 transition-colors">
                    Enter
                </button>
            </div>

            <div className="flex flex-col gap-2">
                {coupons.map((coupon) => (
                    <div
                        key={coupon.code}
                        className={cn(
                            'flex flex-col gap-1.5 rounded-xl border px-3.5 py-3 transition-colors',
                            coupon.applied
                                ? 'border-success-300 bg-linear-to-r from-success-50 via-success-100/80 to-success-200'
                                : 'border-neutral-200 bg-surface'
                        )}
                    >
                        <div className='flex justify-between items-center'>
                            <div>
                                <div className='flex gap-2.5 items-center'>
                                    <Tag
                                        weight="fill"
                                        className={cn(coupon.applied ? 'text-success-500' : 'text-muted', 'mt-1 size-4.5')}
                                    />
                                    <Text size='sm' weight='semibold'>{coupon.code}</Text>
                                </div>
                            </div>
                            <Text size='sm' weight='bold' className={coupon.applied ? 'text-success-800' : 'text-primary'}>-₹{coupon.discount.toLocaleString('en-IN')}</Text>
                        </div>

                        <div className='flex justify-between items-center'>
                            <Text size='xs' className={cn(
                                coupon.applied ? 'text-success-600' : 'text-secondary'
                            )}>
                                {coupon.description}
                            </Text>
                            <button className={cn("text-xs font-heading font-semibold transition-colors", coupon.applied ? 'text-error-500 hover:text-error-600' : 'text-success-600 hover:text-success-600')}>
                                {coupon.applied ? 'Remove' : 'Apply'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export default CoupenCard;