'use client';

import Button from '@/app/components/ui/Button';
import { DownloadSimpleIcon } from '@phosphor-icons/react';

/** Opens the invoice in a new tab and triggers the print dialog so the user can save it as a PDF. */
export default function DownloadReceiptButton({ bookingId }: { bookingId: string }) {
    return (
        <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => window.open(`/bookings/${bookingId}/invoice?download=1`, '_blank')}
        >
            <DownloadSimpleIcon weight="bold" className="size-4" />
            Download receipt
        </Button>
    );
}
