'use client';

import { ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function CloseButton({ closeToast }: { closeToast: () => void }) {
    return (
        <button
            type="button"
            onClick={closeToast}
            aria-label="Dismiss"
            className="ml-2 shrink-0 self-start rounded-full p-1 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600 cursor-pointer"
        >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path fillRule="evenodd" d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
        </button>
    );
}

/** The site-wide restriction-toast look (react-toastify) — kept in its own
 *  client component since a render-prop like `closeButton` can't cross the
 *  server→client boundary from a plain server layout. */
export default function AppToastContainer() {
    return (
        <ToastContainer
            position="top-right"
            autoClose={3500}
            newestOnTop
            closeOnClick
            pauseOnHover
            theme="light"
            transition={Slide}
            limit={3}
            className="w-[min(92vw,360px)]!"
            toastClassName="min-h-0! mb-3! rounded-2xl! border! border-amber-200! bg-amber-50! p-3.5! shadow-lg! shadow-black/5! [&_.Toastify__toast-body]:p-0! [&_.Toastify__toast-body]:items-start! [&_.Toastify__toast-body]:gap-2.5! [&_.Toastify__toast-body]:text-sm! [&_.Toastify__toast-body]:font-medium! [&_.Toastify__toast-body]:text-amber-900!"
            progressClassName="bg-none! bg-amber-400! h-1!"
            closeButton={CloseButton}
        />
    );
}
