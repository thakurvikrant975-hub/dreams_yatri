'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * While the trip is still being arranged, refresh the server component
 * periodically so confirmations/vouchers appear without a manual reload.
 * Slow cadence (fulfilment takes hours/days) and capped so an idle open tab
 * doesn't poll forever. Mounted only when overall === IN_PROGRESS.
 */
export default function StatusAutoRefresh({ intervalMs = 30_000, maxTicks = 20 }: { intervalMs?: number; maxTicks?: number }) {
    const router = useRouter();
    useEffect(() => {
        let ticks = 0;
        const id = setInterval(() => {
            ticks += 1;
            router.refresh();
            if (ticks >= maxTicks) clearInterval(id);
        }, intervalMs);
        return () => clearInterval(id);
    }, [router, intervalMs, maxTicks]);
    return null;
}
