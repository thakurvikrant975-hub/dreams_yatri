'use client'
import { cn } from '@/app/lib/utils'
import { TABS } from '../components/Itnary'

function ItinaryHeaderSkelton() {
    return (
        <div className='flex gap-2 overflow-x-auto px-3.5 py-2.5 no-scrollbar bg-neutral-200/80 rounded-t-[inherit]'>
            {TABS.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-[0.1em] ring-inset text-[13px] font-medium whitespace-nowrap transition-all duration-150 font-heading', id === 'Plan'
                        ? 'bg-brand ring-primary-400 text-white'
                        : 'bg-surface ring-(--border-strong)/40 text-secondary shadow-md shadow-neutral-400/35 hover:bg-neutral-50 cursor-pointer')}
                >
                    <Icon weight='fill' className={cn('shrink-0 size-4', id === 'Plan' ? 'text-primary-50' : 'text-muted')} />
                    {label}
                </button>
            ))}
        </div>
    )
}

export default ItinaryHeaderSkelton
