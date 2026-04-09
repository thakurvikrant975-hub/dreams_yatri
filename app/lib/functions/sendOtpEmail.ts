// app/lib/functions/sendOtpEmail.ts

import { sendEmail } from "@/app/lib/functions/sendEmail";
import { otpEmailTemplate } from "@/app/lib/functions/emailTemplates";

export async function sendOtpEmail(email: string, otp: number): Promise<boolean> {
  return sendEmail({
    to:      email,
    subject: "Your Dreams Yatri OTP",
    html:    otpEmailTemplate(otp),
  });
}