// app/api/auth/magic-link/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_link", req.url)
      );
    }

    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    // Token not found
    if (!verificationToken) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_link", req.url)
      );
    }

    // Email mismatch
    if (verificationToken.identifier !== email) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_link", req.url)
      );
    }

    // Expired
    if (verificationToken.expires < new Date()) {
      await db.verificationToken.delete({ where: { token } });
      return NextResponse.redirect(
        new URL("/login?error=link_expired", req.url)
      );
    }

    // ✅ Valid — consume token
    await db.verificationToken.delete({ where: { token } });

    // Upsert user
    await db.user.upsert({
      where:  { email },
      update: { emailVerified: new Date() },
      create: {
        email,
        phone:         "",
        emailVerified: new Date(),
      },
    });

    // Redirect with email so frontend can call signIn("credentials")
    return NextResponse.redirect(
      new URL(
        `/login?magic=success&email=${encodeURIComponent(email)}`,
        req.url
      )
    );

  } catch (error) {
    console.error("[magic-link/verify]", error);
    return NextResponse.redirect(
      new URL("/login?error=server_error", req.url)
    );
  }
}