import React from 'react'
import Card from '@/app/components/ui/Card'
import { Text, Heading } from '@/app/components/ui/Typography';
import { Skeleton } from '@/app/components/skeltons/rawShimmer';

function CoupenCardSkelton() {
  return (
            <Card className='px-6 py-5'>
            <Heading level={3} weight='semibold'>Coupon &amp; Offer</Heading>
            <div className="flex items-center justify-between mb-3 opacity-50 pointer-events-none">
                <Text size='xs' intent='secondary'>Have Coupon Code?</Text>
                <button className="text-sm font-heading font-semibold text-primary-500 hover:text-primary-600 transition-colors">
                    Enter
                </button>
            </div>

            <div className="flex flex-col gap-3">
                <Skeleton className="w-full h-17 rounded-xl" />
                <Skeleton className="w-full h-17 rounded-xl" />
            </div>
        </Card>
  )
}

export default CoupenCardSkelton;
