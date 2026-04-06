'use client'
import Link from 'next/link';
import { HomeIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { cn } from '@/app/lib/utils';
import { Text } from './Typography';

function Breadcrumbs({
    cat = null,
    cat2 = null,
    title,
    className,
}: {
    cat?: { label: string; link: string } | null;
    cat2?: { label: string; link: string } | null;
    title: string;
    className?: string;
}) {
    return (
        <nav className={cn('flex items-center gap-1.5 text-sm mb-2.5', className)}>

            <Link
                href="/"
                className="text-muted hover:text-primary-500 transition-colors duration-200 flex items-center"
            >
                <HomeIcon className="size-5" />
            </Link>

            {cat && (
                <>
                    <ChevronRightIcon className="text-muted size-3.5 shrink-0" />
                    <Link
                        href={cat.link}
                    >
                        <Text as='span' intent='secondary' size='sm' className='font-heading hover:text-primary-500 transition-colors duration-200'>
                            {cat.label}
                        </Text>

                    </Link>
                </>
            )}


            {cat2 && (
                <>
                    <ChevronRightIcon className="text-muted size-3.5 shrink-0" />
                    <Link
                        href={cat2.link}
                    >
                        <Text as='span' intent='secondary' size='sm' className='font-heading hover:text-primary-500 transition-colors duration-200'>
                            {cat2.label}
                        </Text>
                    </Link>
                </>
            )}

            <ChevronRightIcon className="text-muted size-3.5 shrink-0" />

            <Text as='span' intent='primary' size='sm' truncate={true} className="max-w-xs">
                {title}
            </Text>

        </nav>
    );
}

export default Breadcrumbs;