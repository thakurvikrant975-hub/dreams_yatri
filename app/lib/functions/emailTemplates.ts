// app/lib/functions/emailTemplates.ts

export function otpEmailTemplate(otp: number): string {
  return `
    <div style="font-family: sans-serif; max-width: 400px; margin: auto;">
      <h2>Dreams Yatri – OTP Verification</h2>
      <p>Your one-time password is:</p>
      <h1 style="letter-spacing: 8px; color: #1a1a1a;">${otp}</h1>
      <p>Valid for <strong>10 minutes</strong>. Do not share with anyone.</p>
    </div>
  `;
}

export function magicLinkEmailTemplate(url: string): string {
  const expiryMinutes = 10; // keep in sync with OTP_EXPIRY_MS
  return `
    <div style="font-family: sans-serif; max-width: 400px; margin: auto;">
      <h2>Dreams Yatri – Sign In</h2>
      <p>Click the button below to sign in instantly. No password needed.</p>
      <p style="color: #666;">
        This link expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
      <a href="${url}"
        style="
          display:          inline-block;
          margin-top:       16px;
          padding:          12px 28px;
          background-color: #1a1a1a;
          color:            #ffffff;
          text-decoration:  none;
          border-radius:    6px;
          font-size:        16px;
        "
      >
        Sign In to Dreams Yatri
      </a>
      <p style="margin-top: 24px; color: #999; font-size: 12px;">
        If you did not request this, ignore this email. The link will expire automatically.
      </p>
    </div>
  `;
}