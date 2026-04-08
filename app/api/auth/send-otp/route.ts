import { NextRequest ,NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { generateOtp } from "@/app/lib/functions/generateOtp";



export async function POST(req:NextRequest) {
    const {phone} = await req.json();

    // checking if phone number valid
    if (!phone || !/^\+?[1-9]\d{9,14}$/.test(phone)) {
        return NextResponse.json({error: "Invalid phone number"},{status: 400})
    }

    const recentOtp = await db.otp.findFirst({
        where: {
            phone,
            createdAt: { gte: new Date(Date.now() - 120 * 1000) }, // last 120 seconds
            usedAt: null,
        },
    });

    if (recentOtp) {
        // Calculate remaining time
        const otpLifetime = 120 * 1000; // 120 seconds in milliseconds
        const elapsed = Date.now() - recentOtp.createdAt.getTime();
        const remaining = Math.ceil((otpLifetime - elapsed) / 1000); // in seconds

        return NextResponse.json(
            { error: `OTP already sent. Wait ${remaining} seconds.` },
            { status: 429 }
        );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 120 * 1000)

    await db.otp.create({ data: { phone, code, expiresAt } });

     console.log(`OTP for ${phone}: ${code}`);

  return NextResponse.json({ success: true });
}


export async function GET(req:NextRequest) {
    const otp = generateOtp();
  return NextResponse.json(otp);

}