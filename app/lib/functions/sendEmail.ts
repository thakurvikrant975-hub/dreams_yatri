// app/lib/functions/sendEmail.ts

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailAttachment = {
  filename: string;
  /** Base64-encoded file content (no `data:...;base64,` prefix). */
  content:  string;
};

type EmailPayload = {
  to:          string;
  subject:     string;
  html:        string;
  /**
   * Plain-text alternative. Optional only because most existing callers in
   * this codebase don't pass one yet (HTML-only, no multipart/alternative
   * part — hurts spam scoring and breaks plain-text/screen-reader clients);
   * new callers should always supply one rather than following that example.
   */
  text?:       string;
  attachments?: EmailAttachment[];
};

export async function sendEmail({ to, subject, html, text, attachments }: EmailPayload): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM || "onboarding@resend.dev",
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
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