'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { X, ArrowRight } from 'lucide-react';
import { MapPinIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useBooking } from '../PackageBookingProvider';
import PopupEnquiryForm from './PopupEnquiryForm';

interface Props {
    packageName: string;
    destination?: string;
    packageSlug: string;
    images?: string[];
}

const DELAY_MS       = 30000;
const SLIDE_INTERVAL = 2500;
const AUTO_CLOSE_SEC = 12;

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

    if (images.length === 0) return <div className="absolute inset-0 bg-neutral-800" />;

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

/* ── Enquiry header ─────────────────────────────────────────────────────────── */
function PopupHeader({
    packageName, destination, images, onClose,
}: { packageName: string; destination?: string; images: string[]; onClose: () => void }) {
    const { pricing } = useBooking();
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

    return (
        <div className="relative h-52 sm:h-60 overflow-hidden bg-neutral-900">
            <ImageSlider images={images} />
            <div className="absolute inset-0 bg-linear-to-t from-neutral-900/90 via-neutral-900/20 to-black/20 z-10" />

            <button type="button" onClick={onClose} aria-label="Close"
                className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-sm cursor-pointer transition-colors">
                <X size={15} />
            </button>

            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/15">
                <SparklesIcon className="size-3 text-amber-300 shrink-0" />
                <span className="text-white text-[11px] font-medium tracking-wide">Free Expert Consultation</span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 z-20">
                <h2 className="text-white font-semibold text-base leading-snug line-clamp-2 drop-shadow-sm">{packageName}</h2>
                <div className="flex items-center justify-between mt-1.5 flex-wrap gap-x-3 gap-y-1">
                    {destination && (
                        <span className="flex items-center gap-1 text-white/70 text-xs">
                            <MapPinIcon className="size-3 shrink-0" />{destination}
                        </span>
                    )}
                    {pricing && (
                        <span className="text-white/90 text-xs font-semibold">
                            {fmt(pricing.finalPrice)}<span className="text-white/50 font-normal ml-1">/ total</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Success screen ─────────────────────────────────────────────────────────── */
function SuccessScreen({ destination, countdown, onClose }: {
    destination?: string; countdown: number; onClose: () => void;
}) {
    const progress = (countdown / AUTO_CLOSE_SEC) * 100;

    return (
        <div className="flex flex-col">
            {/* Top decorative strip */}
            <div className="relative h-2 bg-neutral-100 overflow-hidden">
                <div
                    className="absolute left-0 top-0 h-full bg-primary-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="px-6 pt-8 pb-7 text-center flex flex-col items-center">
                {/* Animated checkmark */}
                <div className="relative mb-5">
                    <div className="size-20 rounded-full bg-emerald-50 flex items-center justify-center">
                        <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center">
                            <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                    {/* Pulse ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-300 animate-ping opacity-40" />
                </div>

                <h3 className="text-xl font-bold text-neutral-800 leading-snug">
                    You&apos;re all set! 🎉
                </h3>
                <p className="mt-2 text-sm text-neutral-500 leading-relaxed max-w-xs">
                    Our travel expert is already gearing up to call you — your{' '}
                    <span className="font-semibold text-neutral-700">
                        {destination ? `${destination} adventure` : 'dream trip'}
                    </span>{' '}
                    is about to get very real. 📞✨
                </p>

                {/* Divider */}
                <div className="w-full border-t border-dashed border-neutral-200 my-5" />

                {/* Explore nudge */}
                <p className="text-xs text-neutral-400 mb-3 uppercase tracking-wider font-medium">
                    While you wait…
                </p>
                <Link
                    href="/packages"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                >
                    Explore More Packages
                    <ArrowRight size={14} />
                </Link>

                <button
                    onClick={onClose}
                    className="mt-3 text-xs text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                >
                    Close now · auto-closing in {countdown}s
                </button>
            </div>
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function EnquiryAutoPopup({ packageName, destination, packageSlug, images = [] }: Props) {
    const [open,      setOpen]      = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [countdown, setCountdown] = useState(AUTO_CLOSE_SEC);

    // 30-second show timer — re-arms on every package slug change
    useEffect(() => {
        setSubmitted(false);
        const timer = setTimeout(() => setOpen(true), DELAY_MS);
        return () => { clearTimeout(timer); setOpen(false); };
    }, [packageSlug]);

    // 12-second auto-close countdown after submission
    useEffect(() => {
        if (!submitted) return;
        setCountdown(AUTO_CLOSE_SEC);

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(interval); setOpen(false); return 0; }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [submitted]);

    function handleClose() {
        setOpen(false);
        setSubmitted(false);
    }

    return (
        <Dialog open={open} onClose={handleClose} className="relative z-500">
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
                        {submitted ? (
                            <SuccessScreen
                                destination={destination}
                                countdown={countdown}
                                onClose={handleClose}
                            />
                        ) : (
                            <>
                                <PopupHeader
                                    packageName={packageName}
                                    destination={destination}
                                    images={images}
                                    onClose={handleClose}
                                />
                                <div className="px-6 pt-4 pb-6 overflow-y-auto max-h-[55vh] sm:max-h-none">
                                    <h3 className="font-semibold text-lg text-neutral-800">Your Perfect Journey Starts Here</h3>
                                    <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                                        Leave your phone number, and our travel expert will craft a personalized itinerary tailored to your preferences.
                                    </p>
                                    <PopupEnquiryForm
                                        packageName={packageName}
                                        destination={destination}
                                        onSuccess={() => setSubmitted(true)}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
