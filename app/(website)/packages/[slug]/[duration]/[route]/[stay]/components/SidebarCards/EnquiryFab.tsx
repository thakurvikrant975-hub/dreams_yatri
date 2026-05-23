'use client';

import { useState, type ReactNode } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import Modal, { ModalHeader, ModalBody } from '@/app/components/modals/Modal_Structure';

interface Props {
    children: ReactNode;
}

export default function EnquiryFab({ children }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* FAB — sits above the mobile footer bar */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Send enquiry"
                className="fixed right-4 bottom-19 z-300 lg:hidden w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 active:scale-95 transition-transform"
            >
                <ChatBubbleLeftRightIcon className="size-5" />
            </button>

            {/* Enquiry modal */}
            <Modal open={open} onClose={setOpen} maxWidth="sm">
                <ModalHeader onClose={setOpen}>Send Enquiry</ModalHeader>
                <ModalBody className="p-0">
                    {children}
                </ModalBody>
            </Modal>
        </>
    );
}
