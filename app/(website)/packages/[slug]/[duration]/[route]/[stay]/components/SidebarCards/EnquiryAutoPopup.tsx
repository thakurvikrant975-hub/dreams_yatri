'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { X } from 'lucide-react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useBooking } from '../PackageBookingProvider';
import PopupEnquiryForm from './PopupEnquiryForm';

interface Props {
    packageName: string;
    destination?: string;
    packageSlug: string;
}

const DELAY_MS    = 2500;
const SESSION_KEY = 'eq-popup-shown';

function PopupHeader({
    packageName,
    destination,
    onClose,
}: { packageName: string; destination?: string; onClose: () => void }) {
    const { pricing } = useBooking();
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

    return (
        <div className="relative px-6 pt-8 pb-6 bg-linear-to-br from-primary-600 via-primary-500 to-primary-400 overflow-hidden">
            {/* Decorative circles — same as Login modal */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />

            {/* Close */}
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors"
            >
                <X size={16} />
            </button>

            {/* Title */}
            <p className="relative text-white/70 text-xs font-medium uppercase tracking-wider mb-1">
                Free Expert Consultation
            </p>
            <h2 className="relative text-xl font-bold text-white leading-snug pr-8 line-clamp-2">
                {packageName}
            </h2>

            {/* Destination + price */}
            <div className="relative flex items-center justify-between mt-2 flex-wrap gap-x-4 gap-y-1">
                {destination && (
                    <span className="flex items-center gap-1 text-white/70 text-sm">
                        <MapPinIcon className="size-3.5 shrink-0" />
                        {destination}
                    </span>
                )}
                {pricing && (
                    <span className="text-white font-semibold text-sm">
                        {fmt(pricing.finalPrice)}
                        <span className="text-white/60 font-normal ml-1 text-xs">total</span>
                    </span>
                )}
            </div>
        </div>
    );
}

export default function EnquiryAutoPopup({ packageName, destination, packageSlug }: Props) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const key = `${SESSION_KEY}-${packageSlug}`;
        if (sessionStorage.getItem(key)) return;

        const timer = setTimeout(() => {
            setOpen(true);
            sessionStorage.setItem(key, '1');
        }, DELAY_MS);

        return () => clearTimeout(timer);
    }, [packageSlug]);

    return (
        <Dialog open={open} onClose={setOpen} className="relative z-500">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-neutral-400/55 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200"
            />

            <div className="fixed inset-0 z-10 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <DialogPanel
                    transition
                    className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transition-all data-closed:translate-y-8 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200"
                >
                    {/* data-layout="website" restores scoped CSS-variable utilities (bg-brand, text-secondary, etc.)
                        that don't work in Headless UI portals rendered outside the layout div */}
                    <div data-layout="website">
                        <PopupHeader
                            packageName={packageName}
                            destination={destination}
                            onClose={() => setOpen(false)}
                        />

                        <div className="bg-white px-6 py-5 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
                            <PopupEnquiryForm
                                packageName={packageName}
                                destination={destination}
                                onSuccess={() => setOpen(false)}
                            />
                        </div>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
