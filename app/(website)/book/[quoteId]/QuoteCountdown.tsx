'use client';

import { useEffect, useState } from 'react';
import { Text } from '@/app/components/ui/Typography';


export default function QuoteCountdown({
    expiresAt,
    onExpire,
}: {
    expiresAt: string; // ISO 8601
    onExpire?: () => void;
}) {
    const target = new Date(expiresAt).getTime();
    const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

    useEffect(() => {
        if (remaining <= 0) {
            onExpire?.();
            return;
        }
        const id = setInterval(() => {
            const next = Math.max(0, target - Date.now());
            setRemaining(next);
            if (next <= 0) {
                clearInterval(id);
                onExpire?.();
            }
        }, 1000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    const totalSec = Math.floor(remaining / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    const urgent = remaining > 0 && remaining <= 60_000;

    return (
        <span
            role="timer"
            aria-live="off"
            className={`font-heading font-semibold text-sm tabular-nums ${urgent ? 'text-error-600' : 'text-primary'}`}
        >
            {mm}:{ss}
        </span>
    );
}
