'use client'
import { StatItemI } from '@/app/types/components/ui/StatItem';
import { Text } from './Typography';
import Card from './Card';

function StatItem({ item, fullWidth }: { item: StatItemI; fullWidth?: boolean }) {
    return (
        <div
            className={`flex items-center gap-3 px-5 py-5 lg:py-4 '
                }`}
        >
            <Card className='size-13 rounded-xl flex justify-center items-center'>
                <item.icon weight='fill' className='text-neutral-400 size-6 lg:size-7' />
            </Card>

            <div className="flex flex-col gap-0.5 min-w-0">
                <Text as='span' size='sm' intent='secondary'>
                    {item.label}
                </Text>
                <Text as='span' size='2xl' weight='bold' className='font-heading'>
                    {item.value}
                </Text>
            </div>
        </div>
    )
}

export default StatItem
