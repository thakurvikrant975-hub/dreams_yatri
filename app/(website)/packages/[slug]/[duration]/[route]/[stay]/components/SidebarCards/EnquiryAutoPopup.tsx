'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { X } from 'lucide-react';
import { MapPinIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useBooking } from '../PackageBookingProvider';
import PopupEnquiryForm from './PopupEnquiryForm';

interface Props {
    packageName: string;
    destination?: string;
    packageSlug: string;
    images?: string[];
}

const DELAY_MS      = 30000;
const SLIDE_INTERVAL = 1500;

/* ── Image slider ──────────────────────────────────────────────────────────── */
function ImageSlider({ images }: { images: string[] }) {
    const [current, setCurrent] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

    useEffect(() => {
        if (images.length <= 1) return;
        timerRef.current = setInterval(() => {
            setCurrent(prev => (prev + 1) % images.length);
        }, SLIDE_INTERVAL);
        return () => clearInterval(timerRef.current);
    }, [images.length]);

    if (images.length === 0) {
        return <div className="absolute inset-0 bg-neutral-800" />;
    }

    return (
        <>
            {images.map((src, i) => (
                <img
                    key={src}
                    src={src}
                    alt=""
                    className={[
                        'absolute inset-0 w-full h-full object-cover transition-opacity duration-700',
                        i === current ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                />
            ))}

            {/* Dot indicators */}
            {images.length > 1 && (
                <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5 z-20">
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            className={[
                                'h-1 rounded-full transition-all duration-300 cursor-pointer',
                                i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/40',
                            ].join(' ')}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

/* ── Header ────────────────────────────────────────────────────────────────── */
function PopupHeader({
    packageName,
    destination,
    images,
    onClose,
}: { packageName: string; destination?: string; images: string[]; onClose: () => void }) {
    const { pricing } = useBooking();
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

    return (
        <div className="relative h-52 sm:h-60 overflow-hidden bg-neutral-900">
            <ImageSlider images={images} />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-neutral-900/90 via-neutral-900/20 to-black/20 z-10" />

            {/* Close */}
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-sm cursor-pointer transition-colors"
            >
                <X size={15} />
            </button>

            {/* Top badge */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/15">
                <SparklesIcon className="size-3 text-amber-300 shrink-0" />
                <span className="text-white text-[11px] font-medium tracking-wide">Free Expert Consultation</span>
            </div>

            {/* Package info anchored to bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 z-20">
                <h2 className="text-white font-semibold text-base leading-snug line-clamp-2 drop-shadow-sm">
                    {packageName}
                </h2>
                <div className="flex items-center justify-between mt-1.5 flex-wrap gap-x-3 gap-y-1">
                    {destination && (
                        <span className="flex items-center gap-1 text-white/70 text-xs">
                            <MapPinIcon className="size-3 shrink-0" />
                            {destination}
                        </span>
                    )}
                    {pricing && (
                        <span className="text-white/90 text-xs font-semibold">
                            {fmt(pricing.finalPrice)}
                            <span className="text-white/50 font-normal ml-1">/ total</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function EnquiryAutoPopup({ packageName, destination, packageSlug, images = [] }: Props) {
    const [open, setOpen] = useState(false);

    // Show every time — no sessionStorage gate. Each page visit / refresh /
    // navigation to a new package triggers the 30-second timer fresh.
    useEffect(() => {
        const timer = setTimeout(() => setOpen(true), DELAY_MS);
        return () => {
            clearTimeout(timer);
            setOpen(false); // close if user navigates away before timer fires
        };
    }, [packageSlug]); // re-arms when the package changes

    return (
        <Dialog open={open} onClose={setOpen} className="relative z-500">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200"
            />

            <div className="fixed inset-0 z-10 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <DialogPanel
                    transition
                    className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden bg-white transition-all data-closed:translate-y-8 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200"
                >
                    <div data-layout="website">
                        <PopupHeader
                            packageName={packageName}
                            destination={destination}
                            images={images}
                            onClose={() => setOpen(false)}
                        />

                        <div className="px-6 pt-4 pb-6 overflow-y-auto max-h-[55vh] sm:max-h-none">
                            <h3 className='font-semibold text-lg'>Your Perfect Journey Starts Here</h3>
                            <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                                Leave your phone number, and our travel expert will craft a personalized itinerary tailored to your preferences.
                            </p>
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
