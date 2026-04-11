// app/auth/magic-link/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { generateOtp } from "@/app/lib/functions/generateOtp";
import { sendOtpSms } from "@/app/lib/functions/sendOtpSms";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import { magicLinkEmailTemplate } from "@/app/lib/functions/emailTemplates";
import { randomBytes } from "crypto";

const isValidPhone = (value: string) => /^\+?[1-9]\d{9,14}$/.test(value);
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const OTP_COOLDOWN_MS  = 1 * 1000;      // 120 seconds
const OTP_EXPIRY_MS    = 10 * 60 * 1000;  // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email } = body;

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

    const channel  = phone ? "phone" : "email";
    const identity = (phone ?? email) as string;

    if (channel === "phone" && !isValidPhone(identity)) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    if (channel === "email" && !isValidEmail(identity)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // ── PHONE → OTP via SMS ─────────────────────────────────────────────
    if (channel === "phone") {
      // Rate limit
      const recentOtp = await db.otp.findFirst({
        where: {
          phone: identity,
          createdAt: { gte: new Date(Date.now() - OTP_COOLDOWN_MS) },
          usedAt: null,
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

      const code      = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      await db.otp.create({ data: { phone: identity, code, expiresAt } });

      const sent = await sendOtpSms(identity, code);

      if (!sent) {
        await db.otp.deleteMany({ where: { phone: identity, code } });
        return NextResponse.json(
          { error: "Failed to send OTP. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, channel: "phone" });
    }

    // ── EMAIL → Magic Link ──────────────────────────────────────────────
    if (channel === "email") {
      // Rate limit — reuse VerificationToken createdAt via expires window
      const recentToken = await db.verificationToken.findFirst({
        where: {
          identifier: identity,
          expires:    { gte: new Date(Date.now() + OTP_EXPIRY_MS - OTP_COOLDOWN_MS) },
        },
      });

      if (recentToken) {
        const tokenAge  = OTP_EXPIRY_MS - (recentToken.expires.getTime() - Date.now());
        const remaining = Math.ceil((OTP_COOLDOWN_MS - tokenAge) / 1000);
        if (remaining > 0) {
          return NextResponse.json(
            { error: `Magic link already sent. Wait ${remaining} seconds.` },
            { status: 429 }
          );
        }
      }

      // Delete any existing unused tokens for this email
      await db.verificationToken.deleteMany({
        where: { identifier: identity },
      });

      // Generate token
      const token   = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + OTP_EXPIRY_MS); // same expiry as OTP

      await db.verificationToken.create({
        data: { identifier: identity, token, expires },
      });

      const magicUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/magic-link/verify?token=${token}&email=${encodeURIComponent(identity)}`;

      const sent = await sendEmail({
        to:      identity,
        subject: "Sign in to Dreams Yatri",
        html:    magicLinkEmailTemplate(magicUrl),
      });

      if (!sent) {
        await db.verificationToken.delete({ where: { token } });
        return NextResponse.json(
          { error: "Failed to send magic link. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, channel: "email" });
    }

  } catch (error) {
    console.error("[send-otp]", error);
    return NextResponse.json(
      { error: "Internal server error.", detail: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await db.user.findFirst({
    where: { email: "your@email.com" },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json(user);
}