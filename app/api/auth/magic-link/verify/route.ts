// app/api/auth/magic-link/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { randomBytes } from "crypto";
// app/api/auth/magic-link/verify/route.ts

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    console.log("[magic-link/verify] token:", token);
    console.log("[magic-link/verify] email:", email);

    if (!token || !email) {
      console.log("token or email is missing")
      return NextResponse.redirect(new URL("/?auth_error=invalid_link", req.url));
    }

    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    console.log("[magic-link/verify] verificationToken:", verificationToken);

    if (!verificationToken) {
      return NextResponse.redirect(new URL("/?auth_error=invalid_link", req.url));
    }

    if (verificationToken.identifier !== email) {
      console.log("[magic-link/verify] email mismatch");
      return NextResponse.redirect(new URL("/?auth_error=invalid_link", req.url));
    }

    if (verificationToken.expires < new Date()) {
      console.log("[magic-link/verify] token expired");
      await db.verificationToken.delete({ where: { token } });
      return NextResponse.redirect(new URL("/?auth_error=link_expired", req.url));
    }

    console.log("[magic-link/verify] deleting verification token...");
    await db.verificationToken.delete({ where: { token } });

    console.log("[magic-link/verify] upserting user...");
    await db.user.upsert({
      where:  { email },
      update: { emailVerified: new Date() },
      create: { email, emailVerified: new Date() },
    });

    console.log("[magic-link/verify] creating magic session...");
    const magicToken = randomBytes(32).toString("hex");

    await db.magicSession.create({
      data: {
        token:     magicToken,
        email,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    console.log("[magic-link/verify] redirecting to magic-callback...");
    return NextResponse.redirect(
      new URL(
        `/auth/magic-callback?token=${magicToken}&email=${encodeURIComponent(email)}`,
        req.url
      )
    );

  } catch (error) {
    // ← paste whatever prints here
    console.error("[magic-link/verify] CRASH:", error);
    return NextResponse.redirect(new URL("/?auth_error=server_error", req.url));
  }
}