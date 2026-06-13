import React from 'react'
import { cn } from '@/app/lib/utils'

export default function PackageGrid({ children, className, ...props }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6', className)} {...props}>
            {children}
        </div>
    )
}

