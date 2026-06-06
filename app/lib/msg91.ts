/**
 * MSG91 OTP widget singleton.
 * Initializes the widget once per browser session so multiple components
 * can share it without re-initialization conflicts.
 */

let initialized = false;
let successCb: ((data: any) => void) | null = null;
let failureCb: ((err: any)  => void) | null = null;

function setup(onReady: () => void) {
    const w = window as any;
    if (typeof w.initSendOTP !== 'function') return;
    w.initSendOTP({
        widgetId:      process.env.NEXT_PUBLIC_MSG91_WIDGET_ID!,
        tokenAuth:     process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH!,
        exposeMethods: true,
        success: (d: any) => successCb?.(d),
        failure: (e: any) => failureCb?.(e),
    });
    initialized = true;
    onReady();
}

function ensureReady(onReady: () => void) {
    if (initialized) { onReady(); return; }

    if (typeof (window as any).initSendOTP === 'function') { setup(onReady); return; }

    // Script already in DOM (loading) — poll until available
    if (document.getElementById('msg91-otp-provider')) {
        const poll = setInterval(() => {
            if (typeof (window as any).initSendOTP === 'function') { clearInterval(poll); setup(onReady); }
        }, 100);
        return;
    }

    // Load script fresh
    const urls = ['https://verify.msg91.com/otp-provider.js', 'https://verify.phone91.com/otp-provider.js'];
    let i = 0;
    function attempt() {
        const s = document.createElement('script');
        s.id = 'msg91-otp-provider'; s.src = urls[i]; s.async = true;
        s.onload = () => setup(onReady);
        s.onerror = () => { s.remove(); if (++i < urls.length) attempt(); };
        document.head.appendChild(s);
    }
    attempt();
}

/** Send OTP to `phone` (format: countryCode + digits, no `+`, e.g. `919876543210`). */
export function sendOtp(
    phone: string,
    onSuccess: (data: any) => void,
    onFailure: (err: any)  => void,
    onServiceError: (msg: string) => void,
) {
    successCb = onSuccess;
    failureCb = onFailure;
    ensureReady(() => {
        const w = window as any;
        if (typeof w.sendOtp !== 'function') { onServiceError('OTP service not ready. Please refresh.'); return; }
        w.sendOtp(phone);
    });
}

/** Verify `otp` entered by the user. */
export function verifyOtp(
    otp: string,
    onSuccess: (data: any) => void,
    onFailure: (err: any)  => void,
    onServiceError: (msg: string) => void,
) {
    successCb = onSuccess;
    failureCb = onFailure;
    const w = window as any;
    if (typeof w.verifyOtp !== 'function') { onServiceError('OTP service not ready. Please refresh.'); return; }
    w.verifyOtp(otp);
}
