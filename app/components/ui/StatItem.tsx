import React from 'react'
import { StatItemI } from '@/app/types/components/ui/StatItem';



function StatItem({ item, fullWidth }: { item: StatItemI; fullWidth?: boolean }) {
    return (
        <div
            className={`flex items-center gap-3 px-5 py-5 lg:py-4 '
                }`}
        >
            <div className="flex items-center justify-center  rounded-xl bg-white border border-(--border-default) shadow-md shadow-neutral-300/80 shrink-0 text-xl select-none p-2.5 lg:p-3  ">
                <item.icon weight='fill' className='text-neutral-400 size-6 lg:size-8' />
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs lg:text-sm text-neutral-500 leading-none whitespace-nowrap">
                    {item.label}
                </span>
                <span className="text-2xl lg:text-3xl font-bold font-heading text-neutral-900 leading-tight whitespace-nowrap">
                    {item.value}
                </span>
            </div>
        </div>
    )
}

export default StatItem
