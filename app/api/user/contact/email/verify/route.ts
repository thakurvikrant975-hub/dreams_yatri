// app/api/user/contact/email/verify/route.ts
import { NextRequest } from "next/server";
import { redirect }    from "next/navigation";
import { db }          from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");

  if (!token) return redirect("/profile?contact_error=invalid_link");

  try {
    const pending = await db.pendingContactVerification.findUnique({
      where: { token },
    });

    if (!pending || pending.type !== "email") {
      return redirect("/profile?contact_error=invalid_link");
    }

    if (pending.expiresAt < new Date()) {
      await db.pendingContactVerification.delete({ where: { token } });
      return redirect("/profile?contact_error=link_expired");
    }

    // Re-check uniqueness at click time (race-condition guard)
    const conflict = await db.user.findFirst({
      where: { email: pending.value, NOT: { id: pending.userId } },
      select: { id: true },
    });
    if (conflict) {
      await db.pendingContactVerification.delete({ where: { token } });
      return redirect("/profile?contact_error=email_taken");
    }

    await db.user.update({
      where: { id: pending.userId },
      data:  { email: pending.value, emailVerified: new Date() },
    });

    await db.pendingContactVerification.delete({ where: { token } });

    return redirect("/profile?contact_success=email_updated");
  } catch {
    return redirect("/profile?contact_error=server_error");
  }
}
