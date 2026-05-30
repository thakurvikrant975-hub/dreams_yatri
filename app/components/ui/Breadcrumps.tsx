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
        <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm mb-2.5', className)}>
            <ol className="flex items-center gap-1.5 list-none p-0 m-0">

                <li>
                    <Link
                        href="/"
                        aria-label="Home"
                        className="text-muted hover:text-primary-500 transition-colors duration-200 flex items-center"
                    >
                        <HomeIcon aria-hidden="true" className="size-5" />
                    </Link>
                </li>

                {cat && (
                    <li className="flex items-center gap-1.5">
                        <ChevronRightIcon aria-hidden="true" className="text-muted size-3.5 shrink-0" />
                        <Link href={cat.link}>
                            <Text as='span' intent='secondary' size='sm' className='font-heading hover:text-primary-500 transition-colors duration-200'>
                                {cat.label}
                            </Text>
                        </Link>
                    </li>
                )}

                {cat2 && (
                    <li className="flex items-center gap-1.5">
                        <ChevronRightIcon aria-hidden="true" className="text-muted size-3.5 shrink-0" />
                        <Link href={cat2.link}>
                            <Text as='span' intent='secondary' size='sm' className='font-heading hover:text-primary-500 transition-colors duration-200'>
                                {cat2.label}
                            </Text>
                        </Link>
                    </li>
                )}

                <li className="flex items-center gap-1.5">
                    <ChevronRightIcon aria-hidden="true" className="text-muted size-3.5 shrink-0" />
                    <Text as='span' intent='primary' size='sm' truncate={true} className="max-w-xs" aria-current="page">
                        {title}
                    </Text>
                </li>

            </ol>
        </nav>
    );
}

export default Breadcrumbs;
