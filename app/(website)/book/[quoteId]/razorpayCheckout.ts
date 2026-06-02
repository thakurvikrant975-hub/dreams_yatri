/** Client-side Razorpay checkout helpers (script loader + open). */

export interface RazorpayCheckoutOptions {
    key: string;
    order_id: string;
    amount: number; // paise
    currency: string;
    name: string;
    description?: string;
    prefill?: { name?: string; email?: string; contact?: string };
    notes?: Record<string, string>;
    theme?: { color?: string };
    handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
    }) => void;
    modal?: { ondismiss?: () => void };
}

type RazorpayInstance = { open: () => void };
type RazorpayCtor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;

declare global {
    interface Window {
        Razorpay?: RazorpayCtor;
    }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Inject the Razorpay checkout script once; resolves true when available. */
export function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') return resolve(false);
        if (window.Razorpay) return resolve(true);

        const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve(true), { once: true });
            existing.addEventListener('error', () => resolve(false), { once: true });
            return;
        }

        const s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

export function openRazorpay(options: RazorpayCheckoutOptions): void {
    if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay checkout is not loaded');
    }
    new window.Razorpay(options).open();
}
