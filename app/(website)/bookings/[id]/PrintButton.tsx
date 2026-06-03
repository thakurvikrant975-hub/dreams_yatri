'use client';

import Button from '@/app/components/ui/Button';

/** Print / Save-as-PDF trigger; hidden when printing (parent uses `.no-print`). */
export default function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
    return (
        <div className="no-print mt-6 text-center">
            <Button variant="premium" onClick={() => window.print()}>{label}</Button>
        </div>
    );
}
