'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * While the booking payment is still PENDING (webhook not yet processed),
 * refresh the server component a few times so the confirmed state appears
 * without the user reloading. Stops after `maxTicks`.
 */
export default function StatusPoller({ intervalMs = 4000, maxTicks = 8 }: { intervalMs?: number; maxTicks?: number }) {
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
