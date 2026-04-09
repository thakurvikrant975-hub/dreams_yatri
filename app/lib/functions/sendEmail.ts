// app/lib/functions/sendEmail.ts

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailPayload = {
  to:      string;
  subject: string;
  html:    string;
};

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[sendEmail] Error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[sendEmail] Threw:", err);
    return false;
  }
}