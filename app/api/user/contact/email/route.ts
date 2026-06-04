// app/api/user/contact/email/route.ts
import { NextRequest }            from "next/server";
import { z }                      from "zod/v4";
import { randomBytes }            from "crypto";
import { db }                     from "@/app/lib/db";
import { ApiResponse }            from "@/app/lib/api-response";
import { handleApiError }         from "@/app/lib/api-error";
import { getAuthenticatedUser }   from "@/app/lib/functions/getAuthenticatedUser";
import { sendEmail }              from "@/app/lib/functions/sendEmail";
import { emailChangeVerificationTemplate } from "@/app/lib/functions/emailTemplates";

const schema = z.object({
  email: z.email("Invalid email address"),
});

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? "Invalid email");

    const { email } = parsed.data;

    // Block if same as current
    const currentUser = await db.user.findUnique({
      where:  { id: sessionUser.id },
      select: { email: true },
    });
    if (currentUser?.email === email) {
      return ApiResponse.badRequest("This is already your current email address.");
    }

    // Block if taken by another user
    const conflict = await db.user.findFirst({
      where: { email, NOT: { id: sessionUser.id } },
      select: { id: true },
    });
    if (conflict) return ApiResponse.conflict("This email is already associated with another account.");

    // Invalidate any previous pending verification for this user+type
    await db.pendingContactVerification.deleteMany({
      where: { userId: sessionUser.id, type: "email" },
    });

    const token     = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.pendingContactVerification.create({
      data: { userId: sessionUser.id, type: "email", value: email, token, expiresAt },
    });

    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/user/contact/email/verify?token=${token}`;

    const sent = await sendEmail({
      to:      email,
      subject: "Verify your new email — Dreams Yatri",
      html:    emailChangeVerificationTemplate(verifyUrl),
    });

    if (!sent) return ApiResponse.error("Failed to send verification email. Please try again.", "EMAIL_FAILED", 502);

    return ApiResponse.ok({ message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    return handleApiError(error);
  }
}
