'use client';

import { Dialog, VisuallyHidden } from 'radix-ui';
import { XIcon } from '@phosphor-icons/react';
import GuestChatThread from '../../bookings/[id]/GuestChatThread';

/** Same live conversation as the booking page's chat panel, just opened as a
 * modal directly on the hotel page instead of navigating the guest away —
 * reuses GuestChatThread as-is (real-time via Ably), no separate chat logic. */
export default function HotelChatModal({
    open,
    onClose,
    bookingId,
}: {
    open: boolean;
    onClose: () => void;
    bookingId: string;
}) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-[1px]" />
                <Dialog.Content
                    data-layout="website"
                    className="fixed left-1/2 top-1/2 z-9999 w-[min(28rem,92vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl outline-none flex flex-col"
                    aria-describedby={undefined}
                >
                    <VisuallyHidden.Root asChild>
                        <Dialog.Title>Message host</Dialog.Title>
                    </VisuallyHidden.Root>
                    <Dialog.Close asChild>
                        <button
                            aria-label="Close"
                            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm hover:bg-neutral-100 transition-colors"
                        >
                            <XIcon weight="bold" className="size-4" />
                        </button>
                    </Dialog.Close>
                    <div className="overflow-y-auto">
                        <GuestChatThread bookingId={bookingId} />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
