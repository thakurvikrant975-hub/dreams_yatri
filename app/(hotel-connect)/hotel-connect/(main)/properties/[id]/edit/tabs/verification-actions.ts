"use server";

import { createHmac, randomInt } from "crypto";
import { sendOtpEmail } from "@/app/lib/functions/sendOtpEmail";
import { sendOtpSms } from "@/app/lib/functions/sendOtpSms";

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
    const sent = await sendOtpEmail(trimmed, Number(otp));
    if (!sent) return { ok: false, error: "Failed to send OTP email. Please try again." };
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
    const sent = await sendOtpSms(`${cc}${trimmed}`, Number(otp));
    if (!sent) return { ok: false, error: "Failed to send OTP SMS. Please try again." };
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
