'use client'
import React, { useState } from 'react';
import { cn } from '@/app/lib/utils';
import { Tag } from '@phosphor-icons/react';



const CoupenCard: React.FC<CoupenCardProps> = ({
    coupons = [],
}) => {

    return (
        <div className="bg-surface rounded-2xl border border-neutral-200 p-5">
            <h3 className="text-base font-semibold text-primary mb-1">Coupon &amp; Offer</h3>
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-secondary">Have Coupon Code?</span>
                <button className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors">
                    Enter
                </button>
            </div>

            <div className="flex flex-col gap-2">
                {coupons.map((coupon) => (
                    <div
                        key={coupon.code}
                        className={cn(
                            'flex items-center justify-between rounded-xl border px-3.5 py-3 transition-colors',
                            coupon.applied
                                ? 'border-success-300 bg-success-50'
                                : 'border-neutral-200 bg-surface'
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            <Tag
                                size={16}
                                weight="fill"
                                className={coupon.applied ? 'text-success-600' : 'text-muted'}
                            />
                            <div>
                                <p className="text-sm font-semibold text-primary">{coupon.code}</p>
                                <p className={cn(
                                    'text-xs mt-0.5',
                                    coupon.applied ? 'text-success-600' : 'text-muted'
                                )}>
                                    {coupon.description}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-primary">-₹{coupon.discount.toLocaleString('en-IN')}</p>
                            <button className="text-xs text-error-500 hover:text-error-600 transition-colors mt-0.5">
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CoupenCard;