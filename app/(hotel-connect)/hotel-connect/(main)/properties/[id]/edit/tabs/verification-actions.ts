"use server";

import { createHmac, randomInt } from "crypto";

const SECRET = process.env.OTP_SECRET ?? "dev-hotel-otp-secret-2025";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function signOtp(target: string, otp: string): string {
  const expiry = Date.now() + OTP_TTL_MS;
  const payload = `${target}|${otp}|${expiry}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

function checkOtpToken(target: string, otp: string, token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastPipe = decoded.lastIndexOf("|");
    const sig = decoded.slice(lastPipe + 1);
    const payload = decoded.slice(0, lastPipe);
    const parts = payload.split("|");
    if (parts.length !== 3) return false;
    const [t, o, expiry] = parts;
    if (t !== target || o !== otp) return false;
    if (Date.now() > Number(expiry)) return false;
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    return expected === sig;
  } catch {
    return false;
  }
}

function makeOtp(): string {
  return String(randomInt(100000, 999999));
}

// ── Email OTP ──────────────────────────────────────────────────────────────────

export async function sendEmailOtp(
  email: string,
): Promise<{ ok: boolean; token?: string; devOtp?: string; error?: string }> {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address first" };
  }

  const isDev = process.env.NODE_ENV === "development";
  const otp = isDev ? "123456" : makeOtp();
  const token = signOtp(`email:${trimmed}`, otp);

  if (!isDev) {
    // TODO: plug in transactional email provider (e.g. Resend, SendGrid)
    // await sendMail({ to: trimmed, subject: "Verify your email — DreamsYatri", text: `Your OTP is ${otp}. Valid for 10 minutes.` })
    console.log(`[OTP] Email ${trimmed} — ${otp}`);
  }

  return { ok: true, token, devOtp: isDev ? otp : undefined };
}

export async function verifyEmailOtp(
  email: string,
  otp: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim();
  if (!otp.trim() || !token) return { ok: false, error: "OTP is required" };
  if (!checkOtpToken(`email:${trimmed}`, otp.trim(), token)) {
    return { ok: false, error: "Invalid or expired OTP. Try resending." };
  }
  return { ok: true };
}

// ── Mobile OTP ─────────────────────────────────────────────────────────────────

export async function sendMobileOtp(
  cc: string,
  mobile: string,
): Promise<{ ok: boolean; token?: string; devOtp?: string; error?: string }> {
  const trimmed = mobile.trim();
  if (cc === "+91" && !/^\d{10}$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid 10-digit number first" };
  }
  if (cc !== "+91" && !/^\d{5,15}$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid mobile number first" };
  }

  const isDev = process.env.NODE_ENV === "development";
  const otp = isDev ? "123456" : makeOtp();
  const token = signOtp(`mobile:${cc}${trimmed}`, otp);

  if (!isDev) {
    // TODO: plug in SMS provider (e.g. Fast2SMS, Twilio)
    // await sendSms({ to: `${cc}${trimmed}`, message: `Your DreamsYatri OTP is ${otp}. Valid for 10 minutes.` })
    console.log(`[OTP] Mobile ${cc}${trimmed} — ${otp}`);
  }

  return { ok: true, token, devOtp: isDev ? otp : undefined };
}

export async function verifyMobileOtp(
  cc: string,
  mobile: string,
  otp: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = mobile.trim();
  if (!otp.trim() || !token) return { ok: false, error: "OTP is required" };
  if (!checkOtpToken(`mobile:${cc}${trimmed}`, otp.trim(), token)) {
    return { ok: false, error: "Invalid or expired OTP. Try resending." };
  }
  return { ok: true };
}
