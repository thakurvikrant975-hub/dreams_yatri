import "server-only";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import type { EmailContent } from "./booking-emails";

/**
 * Best-effort transactional send. Comms are side-effects on the money path —
 * a failure is logged and swallowed, never thrown.
 */
export async function sendBookingEmail(to: string | null | undefined, mail: EmailContent): Promise<boolean> {
    // Off by default — production sets NOTIFICATIONS_ENABLED=1 (with a verified sender domain).
    // Keeps dev/tests/e2e from firing real emails to seeded users.
    if (process.env.NOTIFICATIONS_ENABLED !== "1") return false;
    if (!to) return false;
    try {
        return await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (e) {
        console.error("[sendBookingEmail] failed", e);
        return false;
    }
}

/** Configured internal ops inbox (null when unset → ops notifications are skipped). */
export function opsEmail(): string | null {
    const v = process.env.OPS_EMAIL;
    return v && v.trim() !== "" ? v : null;
}
