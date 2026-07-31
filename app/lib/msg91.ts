/**
 * MSG91 OTP widget singleton.
 * Initializes the widget once per browser session so multiple components
 * can share it without re-initialization conflicts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- the widget is an
   untyped third-party global; its payloads are genuinely `any` at this seam. */

let initialized = false;

// Which send/verify call is currently in flight. The widget's global
// success/failure hooks (registered once in `setup`) are shared across every
// operation, so without this a late hook from an abandoned call could resolve
// a newer, unrelated one.
let activeOp = 0;

/**
 * The `reqId` MSG91 issues for the current OTP, taken from its /sendOtp
 * response (`{ message: <reqId>, type: 'success' }`).
 *
 * The widget also stores this internally, but ONLY once that response lands —
 * and its /verifyOtp call falls back to that internal copy
 * (`reqId: explicitArg ?? store.otpGenerateData.reqId`). Verifying before the
 * response arrived therefore sent no reqId at all and MSG91 replied
 * `{"message":"reqId is required.","hasError":true}` — the login dead-end this
 * module used to produce. We capture it ourselves and pass it explicitly to
 * `verifyOtp` so a verify can never depend on that internal timing.
 */
let lastReqId: string | null = null;

let successCb: ((data: any) => void) | null = null;
let failureCb: ((err: any)  => void) | null = null;

// Guards against a hung third-party call leaving the caller with no response
// at all (observed: the widget resolving neither hook on some error paths).
const SEND_TIMEOUT_MS   = 20_000;
const VERIFY_TIMEOUT_MS = 20_000;

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

/** MSG91 returns the reqId as the `message` of a successful /sendOtp. */
function captureReqId(data: any) {
    const id = typeof data === 'string' ? data : data?.message;
    if (typeof id === 'string' && id) lastReqId = id;
}

/**
 * Send an OTP to `phone` (format: countryCode + digits, no `+`, e.g.
 * `919876543210`).
 *
 * `onSent` fires only once MSG91 has actually confirmed the send and we hold
 * its reqId — NOT merely once the request was dispatched. Callers gate their
 * "enter the code" UI on it, and revealing that UI early let a guest submit
 * before a reqId existed, which MSG91 rejects outright (see `lastReqId`).
 */
export function sendOtp(
    phone: string,
    onSent: () => void,
    onFailure: (err: any)  => void,
    onServiceError: (msg: string) => void,
) {
    ensureReady(() => {
        const w = window as any;
        if (typeof w.sendOtp !== 'function') { onServiceError('OTP service not ready. Please refresh.'); return; }

        const op = ++activeOp;
        let settled = false;
        const settle = (fn: () => void) => {
            if (settled || op !== activeOp) return;
            settled = true;
            fn();
        };

        const handleSuccess = (d: any) => settle(() => { captureReqId(d); onSent(); });
        const handleFailure = (e: any) => settle(() => onFailure(e));

        // Per-call callbacks are the widget's documented API and the reliable
        // signal; the global hooks are kept as a fallback for paths that only
        // invoke those.
        successCb = handleSuccess;
        failureCb = handleFailure;
        lastReqId = null; // a new send invalidates any previous OTP's reqId

        w.sendOtp(phone, handleSuccess, handleFailure);

        setTimeout(() => settle(() => onServiceError('Could not send the OTP. Please try again.')), SEND_TIMEOUT_MS);
    });
}

/** Verify `otp` entered by the user. */
export function verifyOtp(
    otp: string,
    onSuccess: (data: any) => void,
    onFailure: (err: any)  => void,
    onServiceError: (msg: string) => void,
) {
    const w = window as any;
    if (typeof w.verifyOtp !== 'function') { onServiceError('OTP service not ready. Please refresh.'); return; }

    const op = ++activeOp;
    let settled = false;
    const settle = (fn: () => void) => {
        if (settled || op !== activeOp) return;
        settled = true;
        fn();
    };

    const handleSuccess = (d: any) => settle(() => onSuccess(d));
    const handleFailure = (e: any) => settle(() => onFailure(e));

    successCb = handleSuccess;
    failureCb = handleFailure;

    // 4th arg is the reqId. Passing ours explicitly means the widget never has
    // to fall back to its own (possibly not-yet-populated) internal copy.
    w.verifyOtp(otp, handleSuccess, handleFailure, lastReqId);

    setTimeout(() => settle(() => onServiceError('Verification is taking too long. Please try again.')), VERIFY_TIMEOUT_MS);
}
