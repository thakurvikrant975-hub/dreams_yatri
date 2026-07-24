/**
 * MSG91 OTP widget singleton.
 * Initializes the widget once per browser session so multiple components
 * can share it without re-initialization conflicts.
 */

let initialized = false;
let successCb: ((data: any) => void) | null = null;
let failureCb: ((err: any)  => void) | null = null;

function setup(onReady: () => void) {
    if (initialized) { onReady(); return; }
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

/** Kicks off the (potentially slow, first-load-only) widget script fetch
 * ahead of time — call this as early as possible (e.g. on login modal mount)
 * so that by the time the user actually submits their phone number,
 * `sendOtp` below can call `w.sendOtp(phone)` immediately instead of the
 * caller racing an in-flight script load. Safe to call multiple times. */
export function preloadOtpWidget() {
    ensureReady(() => {});
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

/**
 * Send OTP to `phone` (format: countryCode + digits, no `+`, e.g. `919876543210`).
 * The widget's own success/failure hooks (registered once in `setup`) only
 * ever fire for `verifyOtp` below, not for the send step itself — so `onSent`
 * here just confirms `w.sendOtp(phone)` was actually invoked (which may
 * require an async, first-load-only script fetch via `ensureReady`), not
 * that the SMS was delivered. Callers should wait for `onSent` before
 * showing an "OTP sent" screen, rather than assuming it fired synchronously.
 */
export function sendOtp(
    phone: string,
    onSent: () => void,
    onFailure: (err: any)  => void,
    onServiceError: (msg: string) => void,
) {
    failureCb = onFailure;
    ensureReady(() => {
        const w = window as any;
        if (typeof w.sendOtp !== 'function') { onServiceError('OTP service not ready. Please refresh.'); return; }
        w.sendOtp(phone);
        onSent();
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
