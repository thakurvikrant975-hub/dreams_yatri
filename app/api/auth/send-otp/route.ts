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

    const recentOtp = await db.otp.findFirst({
      where: {
        ...(channel === "phone" ? { phone: identity } : { email: identity }),
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

    const code      = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    if (channel === "phone") {
      await db.otp.create({ data: { phone: identity, code, expiresAt } });
    } else {
      await db.otp.create({ data: { email: identity, code, expiresAt } });
    }

// ✅ Replace with this
if (channel === "phone") {
  const sent = await sendOtpSms(identity, code);
  if (!sent) {
    await db.otp.deleteMany({ where: { phone: identity, code } });
    return NextResponse.json(
      { error: "Failed to send OTP via phone. Please try again." },
      { status: 502 }
    );
  }
} else {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from:    "onboarding@resend.dev",
      to:      identity,
      subject: "Your Dreams Yatri OTP",
      html:    `<h1>Your OTP is: ${code}</h1>`,
    });

    console.log("Resend response:", { data, error });

    if (error) {
      await db.otp.deleteMany({ where: { email: identity, code } });
      return NextResponse.json(
        { error: "Failed to send OTP via email.", detail: error },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Resend threw:", err);
    await db.otp.deleteMany({ where: { email: identity, code } });
    return NextResponse.json(
      { error: "Failed to send OTP via email.", detail: JSON.stringify(err) },
      { status: 502 }
    );
  }
}

return NextResponse.json({ success: true, channel });

  } catch (error) {
    // ← This will tell you exactly what's failing
    console.error("[send-otp] Error:", error);
    return NextResponse.json(
      { error: "Internal server error.", detail: (error as Error).message },
      { status: 500 }
    );
  }
}