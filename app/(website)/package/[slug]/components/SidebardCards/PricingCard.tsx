'use client'
import React from 'react';
import Button from '@/app/components/ui/Button';

const PricingCard: React.FC<PricingCardProps> = ({
    originalPrice,
    discountedPrice,
    savings,
    className,
}) => {

    const fmt = (n: number) =>
        `₹${n.toLocaleString('en-IN')}`;
    return (
        <div className="bg-surface rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm text-muted line-through">{fmt(originalPrice)}</span>
                <span className="text-xs font-medium bg-success-50 text-success-700 px-2.5 py-0.5 rounded-full">
                    Save INR {(savings).toLocaleString('en-IN')}
                </span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-primary">
                    {fmt(discountedPrice)}
                </span>
                <span className="text-sm text-muted">/Adults</span>
            </div>
            <p className="text-xs text-muted mt-1">Excluding applicable taxes</p>
            <Button variant="error" size="lg" className="w-full mt-4 rounded-xl">
                Proceed To Payment
            </Button>
        </div>
    );
};

export default PricingCard;