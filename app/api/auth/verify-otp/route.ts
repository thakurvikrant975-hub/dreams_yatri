// app/api/auth/send-otp/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { generateOtp } from "@/app/lib/functions/generateOtp";
import { sendOtpSms } from "@/app/lib/functions/sendOtpSms";
import { sendOtpEmail } from "@/app/lib/functions/sendOtpEmail";

// ── Validators ─────────────────────────────────────────────────────────────
const isValidPhone = (value: string) => /^\+?[1-9]\d{9,14}$/.test(value);
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const OTP_COOLDOWN_MS = 120 * 1000; // 120 seconds
const OTP_EXPIRY_MS   = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, email } = body;

  // ── Must provide one or the other, not both ─────────────────────────────
  if (!phone && !email) {
    return NextResponse.json(
      { error: "Phone number or email is required." },
      { status: 400 }
    );
  }

  if (phone && email) {
    return NextResponse.json(
      { error: "Provide either phone or email, not both." },
      { status: 400 }
    );
  }

  // ── Determine channel ───────────────────────────────────────────────────
  const channel  = phone ? "phone" : "email";
  const identity = phone ?? email; // the actual value

  // ── Validate format ─────────────────────────────────────────────────────
  if (channel === "phone" && !isValidPhone(identity)) {
    return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  }

  if (channel === "email" && !isValidEmail(identity)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  // ── Rate limit — shared logic for both channels ─────────────────────────
  const whereClause =
    channel === "phone"
      ? { phone: identity }
      : { email: identity };

  const recentOtp = await db.otp.findFirst({
    where: {
      ...whereClause,
      createdAt: { gte: new Date(Date.now() - OTP_COOLDOWN_MS) },
      usedAt:    null,
    },
  });

  if (recentOtp) {
    const elapsed   = Date.now() - recentOtp.createdAt.getTime();
    const remaining = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: `OTP already sent. Wait ${remaining} seconds.` },
      { status: 429 }
    );
  }

  // ── Generate and store OTP ──────────────────────────────────────────────
  const code      = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await db.otp.create({
    data: {
      ...(channel === "phone" ? { phone: identity } : { email: identity }),
      code,
      expiresAt,
    },
  });

  // ── Send OTP via correct channel ────────────────────────────────────────
  const sent =
    channel === "phone"
      ? await sendOtpSms(identity, code)
      : await sendOtpEmail(identity, code);

  if (!sent) {
    // Rollback — let user retry immediately
    await db.otp.deleteMany({
      where: { ...whereClause, code },
    });
    return NextResponse.json(
      { error: `Failed to send OTP via ${channel}. Please try again.` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    channel,                          // tells frontend which channel was used
  });
}