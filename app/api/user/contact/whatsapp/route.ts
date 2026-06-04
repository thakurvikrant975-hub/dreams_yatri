// app/api/user/contact/whatsapp/route.ts
import { NextRequest }            from "next/server";
import { z }                      from "zod/v4";
import { randomBytes }            from "crypto";
import { db }                     from "@/app/lib/db";
import { ApiResponse }            from "@/app/lib/api-response";
import { handleApiError }         from "@/app/lib/api-error";
import { getAuthenticatedUser }   from "@/app/lib/functions/getAuthenticatedUser";
import { generateOtp }            from "@/app/lib/functions/generateOtp";
import { sendWhatsappOtp }        from "@/app/lib/functions/sendWhatsappOtp";

const schema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number"),
});

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? "Invalid phone number");

    const { phone } = parsed.data;

    // Block if same as current
    const currentUser = await db.user.findUnique({
      where:  { id: sessionUser.id },
      select: { whatsapp: true },
    });
    if (currentUser?.whatsapp === phone) {
      return ApiResponse.badRequest("This is already your current WhatsApp number.");
    }

    // Block if taken by another user
    const conflict = await db.user.findFirst({
      where: { whatsapp: phone, NOT: { id: sessionUser.id } },
      select: { id: true },
    });
    if (conflict) return ApiResponse.conflict("This WhatsApp number is already linked to another account.");

    // Invalidate any previous pending verification for this user+type
    await db.pendingContactVerification.deleteMany({
      where: { userId: sessionUser.id, type: "whatsapp" },
    });

    // Also clean up any stale OTPs for this number
    await db.otp.deleteMany({
      where: { phone, usedAt: null },
    });

    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.otp.create({
      data: { phone, code: otp, expiresAt },
    });

    const token = randomBytes(32).toString("hex");
    await db.pendingContactVerification.create({
      data: { userId: sessionUser.id, type: "whatsapp", value: phone, token, expiresAt },
    });

    const sent = await sendWhatsappOtp(phone, otp);
    if (!sent) {
      // Clean up if sending failed
      await db.pendingContactVerification.deleteMany({ where: { token } });
      await db.otp.deleteMany({ where: { phone, usedAt: null } });
      return ApiResponse.error("Failed to send WhatsApp OTP. Please try again.", "WHATSAPP_FAILED", 502);
    }

    return ApiResponse.ok({ token, message: "OTP sent to WhatsApp." });
  } catch (error) {
    return handleApiError(error);
  }
}
