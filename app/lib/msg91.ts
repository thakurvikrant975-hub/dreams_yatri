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
    console.log('[MSG91] setup — initSendOTP type:', typeof w.initSendOTP);
    if (typeof w.initSendOTP !== 'function') {
        console.error('[MSG91] initSendOTP is not a function — script may not have loaded');
        return;
    }
    w.initSendOTP({
        widgetId:      process.env.NEXT_PUBLIC_MSG91_WIDGET_ID!,
        tokenAuth:     process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH!,
        exposeMethods: true,
        success: (d: any) => { console.log('[MSG91] ✅ verify success', d); successCb?.(d); },
        failure: (e: any) => { console.warn('[MSG91] ❌ verify failure', e); failureCb?.(e); },
    });
    console.log('[MSG91] initSendOTP called. window.sendOtp type after init:', typeof w.sendOtp);
    initialized = true;
    onReady();
}

function ensureReady(onReady: () => void) {
    console.log('[MSG91] ensureReady — initialized:', initialized, '| initSendOTP:', typeof (window as any).initSendOTP, '| sendOtp:', typeof (window as any).sendOtp);

    if (initialized) { onReady(); return; }

    if (typeof (window as any).initSendOTP === 'function') { setup(onReady); return; }

    // Script already in DOM (loading) — poll until available
    if (document.getElementById('msg91-otp-provider')) {
        console.log('[MSG91] script tag found in DOM, polling for initSendOTP…');
        const poll = setInterval(() => {
            if (typeof (window as any).initSendOTP === 'function') { clearInterval(poll); setup(onReady); }
        }, 100);
        return;
    }

    // Load script fresh
    console.log('[MSG91] loading otp-provider script…');
    const urls = ['https://verify.msg91.com/otp-provider.js', 'https://verify.phone91.com/otp-provider.js'];
    let i = 0;
    function attempt() {
        const s = document.createElement('script');
        s.id = 'msg91-otp-provider'; s.src = urls[i]; s.async = true;
        s.onload = () => { console.log('[MSG91] script loaded from', urls[i]); setup(onReady); };
        s.onerror = () => {
            console.warn('[MSG91] script failed from', urls[i]);
            s.remove();
            if (++i < urls.length) attempt();
            else console.error('[MSG91] all script URLs failed');
        };
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
    console.log('[MSG91] sendOtp — phone:', phone);
    successCb = onSuccess;
    failureCb = onFailure;
    ensureReady(() => {
        const w = window as any;
        console.log('[MSG91] sendOtp ready — window.sendOtp type:', typeof w.sendOtp);
        if (typeof w.sendOtp !== 'function') {
            console.error('[MSG91] window.sendOtp is not a function after init!');
            onServiceError('OTP service not ready. Please refresh.');
            return;
        }
        console.log('[MSG91] calling window.sendOtp(', phone, ')');
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
    console.log('[MSG91] verifyOtp — otp:', otp);
    successCb = onSuccess;
    failureCb = onFailure;
    const w = window as any;
    console.log('[MSG91] verifyOtp — window.verifyOtp type:', typeof w.verifyOtp);
    if (typeof w.verifyOtp !== 'function') {
        console.error('[MSG91] window.verifyOtp is not a function!');
        onServiceError('OTP service not ready. Please refresh.');
        return;
    }
    w.verifyOtp(otp);
}
