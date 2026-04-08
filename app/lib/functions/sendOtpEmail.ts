// app/lib/functions/sendOtpEmail.ts

export async function sendOtpEmail(email: string, otp: number): Promise<boolean> {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from:    "Dreams Yatri <noreply@dreamsyatri.com>",
    to:      email,
    subject: "Your Dreams Yatri OTP",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: auto;">
        <h2>Dreams Yatri – OTP Verification</h2>
        <p>Your one-time password is:</p>
        <h1 style="letter-spacing: 8px; color: #1a1a1a;">${otp}</h1>
        <p>Valid for <strong>10 minutes</strong>. Do not share with anyone.</p>
      </div>
    `,
  });

  if (error) {
    console.error("[sendOtpEmail] Resend error:", error); // ← check terminal
    return false;
  }

  console.log("[sendOtpEmail] Sent successfully:", data);
  return true;
}