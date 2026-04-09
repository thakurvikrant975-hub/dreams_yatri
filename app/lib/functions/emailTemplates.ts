// app/lib/functions/emailTemplates.ts

const BRAND_RED    = "#dc2626";   // tailwind red-600
const BRAND_DARK   = "#111111";
const BORDER_COLOR = "#e5e7eb";
const TEXT_MUTED   = "#6b7280";
const BG_LIGHT     = "#f9fafb";

function baseTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

            <!-- Header -->
            <tr>
              <td style="background:#aaa;border-radius:8px 8px 0 0;padding:28px 40px;text-align:center;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Dreams Yatri</span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="background:#ffffff;padding:40px;border-left:1px solid ${BORDER_COLOR};border-right:1px solid ${BORDER_COLOR};">
                ${content}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:${BG_LIGHT};border:1px solid ${BORDER_COLOR};border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:${TEXT_MUTED};">
                  Dreams Yatri (OPC) Private Limited · Shimla, Himachal Pradesh
                </p>
                <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">
                  This is an automated message. Please do not reply to this email.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function otpEmailTemplate(otp: number): string {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND_RED};letter-spacing:1px;text-transform:uppercase;">Verification Code</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${BRAND_DARK};">Your one-time password</h1>

    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Use the code below to complete your sign-in. Do not share this code with anyone.
    </p>

    <!-- OTP Box -->
    <div style="background:${BG_LIGHT};border:1px solid ${BORDER_COLOR};border-radius:8px;padding:28px;text-align:center;margin:0 0 28px;">
      <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:${BRAND_DARK};">${otp}</span>
    </div>

    <!-- Expiry Notice -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#fef2f2;border-left:3px solid ${BRAND_RED};border-radius:0 4px 4px 0;padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#991b1b;">
            This code expires in <strong>10 minutes</strong>.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      If you did not request this code, you can safely ignore this email.
      Someone may have entered your contact details by mistake.
    </p>
  `;

  return baseTemplate(content);
}

export function magicLinkEmailTemplate(url: string): string {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND_RED};letter-spacing:1px;text-transform:uppercase;">Sign In Link</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${BRAND_DARK};">Sign in to Dreams Yatri</h1>

    <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
      Click the button below to sign in instantly. No password needed.
      This link is single-use and expires in <strong>10 minutes</strong>.
    </p>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
      <tr>
        <td align="center">
          <a href="${url}"
            style="
              display:         inline-block;
              background:      ${BRAND_RED};
              color:           #ffffff;
              font-size:       15px;
              font-weight:     600;
              text-decoration: none;
              padding:         14px 36px;
              border-radius:   6px;
              letter-spacing:  0.3px;
            "
          >
            Sign In to Dreams Yatri
          </a>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-top:1px solid ${BORDER_COLOR};padding-top:24px;">
          <p style="margin:0 0 8px;font-size:12px;color:${TEXT_MUTED};">
            Button not working? Copy and paste this link into your browser:
          </p>
          <p style="margin:0;font-size:12px;color:${BRAND_RED};word-break:break-all;">${url}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      If you did not request this link, you can safely ignore this email.
      Your account will remain secure.
    </p>
  `;

  return baseTemplate(content);
}