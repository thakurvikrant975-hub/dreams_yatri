// app/api/user/contact/whatsapp/verify/route.ts
import { NextRequest }            from "next/server";
import { z }                      from "zod/v4";
import { db }                     from "@/app/lib/db";
import { ApiResponse }            from "@/app/lib/api-response";
import { handleApiError }         from "@/app/lib/api-error";
import { getAuthenticatedUser }   from "@/app/lib/functions/getAuthenticatedUser";

const MAX_ATTEMPTS = 3;

const schema = z.object({
  token: z.string().min(1),
  otp:   z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

    const { token, otp } = parsed.data;

    // Find the pending verification
    const pending = await db.pendingContactVerification.findUnique({ where: { token } });

    if (!pending || pending.userId !== sessionUser.id || pending.type !== "whatsapp") {
      return ApiResponse.error("Invalid or expired verification session.", "INVALID_TOKEN", 400);
    }

    if (pending.expiresAt < new Date()) {
      await db.pendingContactVerification.delete({ where: { token } });
      return ApiResponse.error("Verification session expired. Please start again.", "SESSION_EXPIRED", 410);
    }

    // Find the active OTP record
    const otpRecord = await db.otp.findFirst({
      where: {
        phone:    pending.value,
        usedAt:   null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return ApiResponse.error("OTP expired. Please request a new one.", "OTP_EXPIRED", 410);
    }

    // Check attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await db.otp.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });
      await db.pendingContactVerification.delete({ where: { token } });
      return ApiResponse.error("Too many incorrect attempts. Please start again.", "TOO_MANY_ATTEMPTS", 429);
    }

    if (otpRecord.code !== parseInt(otp, 10)) {
      await db.otp.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } });
      const remaining = MAX_ATTEMPTS - (otpRecord.attempts + 1);
      return ApiResponse.badRequest(
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Incorrect OTP. No attempts remaining."
      );
    }

    // OTP correct — re-check uniqueness at verify time
    const conflict = await db.user.findFirst({
      where: { whatsapp: pending.value, NOT: { id: sessionUser.id } },
      select: { id: true },
    });
    if (conflict) {
      return ApiResponse.conflict("This WhatsApp number is already linked to another account.");
    }

    // Commit changes
    await db.otp.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });
    await db.user.update({ where: { id: sessionUser.id }, data: { whatsapp: pending.value } });
    await db.pendingContactVerification.delete({ where: { token } });

    return ApiResponse.ok({ message: "WhatsApp number verified and saved." });
  } catch (error) {
    return handleApiError(error);
  }
}
