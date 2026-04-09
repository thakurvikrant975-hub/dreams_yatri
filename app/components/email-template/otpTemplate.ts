// app/lib/email/templates/otpTemplate.ts

import { buildEmail } from "./emailWrapper";
import {
  EmailLabel,
  EmailTitle,
  EmailText,
  EmailOtpBox,
  EmailAlert,
  EmailMuted,
} from "./emailBlocks";

export function otpEmailTemplate(otp: number): string {
  const body = `
    ${EmailLabel("Verification Code")}
    ${EmailTitle("Your one-time password")}
    ${EmailText("Use the code below to complete your sign-in. Do not share this code with anyone.")}
    ${EmailOtpBox(otp)}
    ${EmailAlert("This code expires in <strong>10 minutes</strong>.")}
    ${EmailMuted("If you did not request this code, you can safely ignore this email. Someone may have entered your contact details by mistake.")}
  `;

  return buildEmail(body);
}