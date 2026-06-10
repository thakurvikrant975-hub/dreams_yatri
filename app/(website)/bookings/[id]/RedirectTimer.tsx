'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClockCountdownIcon } from '@phosphor-icons/react';
import { Text } from '@/app/components/ui/Typography';

/** Counts down from `seconds` then redirects to `href`. */
export default function RedirectTimer({ href, seconds = 10 }: { href: string; seconds?: number }) {
    const router = useRouter();
    const [remaining, setRemaining] = useState(seconds);

    useEffect(() => {
        if (remaining <= 0) {
            router.push(href);
            return;
        }
        const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
        return () => clearTimeout(id);
    }, [remaining, router, href]);

    return (
        <div className="mt-5">
            <div className="flex items-center justify-center gap-1.5">
                <ClockCountdownIcon weight="bold" className="size-3.5 text-(--text-muted)" />
                <Text size="xs" intent="muted">
                    Taking you to your trip status in {remaining}s…
                </Text>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                    className="h-full rounded-full bg-primary-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${(remaining / seconds) * 100}%` }}
                />
            </div>
        </div>
    );
}
