// app/lib/email/components/emailWrapper.ts

const BORDER_COLOR = "#e5e7eb";
const TEXT_MUTED   = "#6b7280";
const BG_LIGHT     = "#f9fafb";

// Emails need an absolute, publicly reachable image URL — falls back to the
// real production domain (not localhost) for the same reason the itinerary
// share link does; see package-builder/action.ts's baseUrl comment.
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://dreamsyatri.org";
const LOGO_URL = `${SITE_URL}/dy_logo_email.png`;

export function EmailHeader(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

            <!-- Brand Header -->
            <tr>
              <td style="background:#ffffff;border:1px solid ${BORDER_COLOR};border-bottom:none;border-radius:8px 8px 0 0;padding:24px 40px;text-align:center;">
                <img src="${LOGO_URL}" alt="Dreams Yatri" width="180" style="width:180px;height:auto;display:inline-block;" />
              </td>
            </tr>

            <!-- Body Start -->
            <tr>
              <td style="background:#ffffff;padding:40px;border-left:1px solid ${BORDER_COLOR};border-right:1px solid ${BORDER_COLOR};">
  `;
}

export function EmailFooter(): string {
  return `
              </td>
            </tr>
            <!-- End Body -->

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

// Wraps any body content between header and footer
export function buildEmail(body: string): string {
  return `${EmailHeader()}${body}${EmailFooter()}`;
}