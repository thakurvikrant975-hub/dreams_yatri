// app/lib/functions/emailTemplates.ts

const BRAND_RED    = "#dc2626";   // tailwind red-600
const BRAND_DARK   = "#111111";
const BORDER_COLOR = "#e5e7eb";
const TEXT_MUTED   = "#6b7280";
const BG_LIGHT     = "#f9fafb";
const PRE_HEADING  = "oklch(55.1% 0.027 264.364)"
const SITE_URL  = process.env.NEXT_PUBLIC_BASE_URL;




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
              <td style="background:oklch(92.2% 0 0);border-radius:8px 8px 0 0;padding:28px 40px;text-align:center;">
                <img src='${SITE_URL}/dy_logo.webp' style='height:50px'>
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
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${PRE_HEADING};letter-spacing:1px;text-transform:uppercase;">Verification Code</p>
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

export function emailChangeVerificationTemplate(url: string): string {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${PRE_HEADING};letter-spacing:1px;text-transform:uppercase;">Email Verification</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${BRAND_DARK};">Verify your new email address</h1>

    <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
      You requested to update your email address on Dreams Yatri.
      Click the button below to confirm this is your email.
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
            Verify Email Address
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
          <a href='${url}' style="margin:0;font-size:12px;color:oklch(62.3% 0.214 259.815);word-break:break-all;">${url}</a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      If you did not request this change, you can safely ignore this email.
      Your existing email address will remain unchanged.
    </p>
  `;

  return baseTemplate(content);
}

export function hotelOwnerVerificationEmailTemplate(name: string, url: string): string {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${PRE_HEADING};letter-spacing:1px;text-transform:uppercase;">Hotel Connect</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${BRAND_DARK};">Verify your email, ${name}</h1>

    <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
      Thanks for signing up for Dreams Yatri Hotel Connect. Please confirm this is your email
      address so we know how to reach you about your property and bookings.
      This link expires in <strong>24 hours</strong>.
    </p>

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
            Verify Email Address
          </a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-top:1px solid ${BORDER_COLOR};padding-top:24px;">
          <p style="margin:0 0 8px;font-size:12px;color:${TEXT_MUTED};">
            Button not working? Copy and paste this link into your browser:
          </p>
          <a href='${url}' style="margin:0;font-size:12px;color:oklch(62.3% 0.214 259.815);word-break:break-all;">${url}</a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      You can keep using your dashboard while unverified, but you'll need to verify before your
      property can go live for guests to book.
    </p>
  `;

  return baseTemplate(content);
}

export function hotelOwnerPasswordResetTemplate(name: string, url: string): string {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${PRE_HEADING};letter-spacing:1px;text-transform:uppercase;">Hotel Connect</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${BRAND_DARK};">Reset your password, ${name}</h1>

    <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
      We received a request to reset the password for your Dreams Yatri Hotel Connect account.
      Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.
    </p>

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
            Reset Password
          </a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-top:1px solid ${BORDER_COLOR};padding-top:24px;">
          <p style="margin:0 0 8px;font-size:12px;color:${TEXT_MUTED};">
            Button not working? Copy and paste this link into your browser:
          </p>
          <a href='${url}' style="margin:0;font-size:12px;color:oklch(62.3% 0.214 259.815);word-break:break-all;">${url}</a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      If you did not request a password reset, you can safely ignore this email —
      your password will remain unchanged.
    </p>
  `;

  return baseTemplate(content);
}

export interface PackagePaymentReceiptData {
  bookingNumber: string;
  packageName: string;
  destination: string;
  travelDate: string;
  duration: string;
  travellers: number;
  breakdown: { label: string; amount: string }[];
  subtotal: string;
  gst?: string;
  amountPaid: string;
  paymentPlan: "FULL" | "DEPOSIT";
  balanceDue?: string;
  balanceDueDate?: string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt: string;
  customerName: string;
}

export function packagePaymentReceiptTemplate(data: PackagePaymentReceiptData): string {
  const {
    bookingNumber, packageName, destination, travelDate, duration,
    travellers, breakdown, subtotal, gst, amountPaid, paymentPlan,
    balanceDue, balanceDueDate, paymentMethod, transactionId, paidAt, customerName,
  } = data;

  const isDeposit = paymentPlan === "DEPOSIT";

  const breakdownRows = breakdown
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#374151;border-bottom:1px solid ${BORDER_COLOR};">${item.label}</td>
        <td style="padding:10px 0;font-size:14px;color:#374151;text-align:right;border-bottom:1px solid ${BORDER_COLOR};">₹${item.amount}</td>
      </tr>`,
    )
    .join("");

  const gstRow = gst
    ? `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:${TEXT_MUTED};border-bottom:1px solid ${BORDER_COLOR};">GST & Taxes</td>
        <td style="padding:10px 0;font-size:14px;color:${TEXT_MUTED};text-align:right;border-bottom:1px solid ${BORDER_COLOR};">₹${gst}</td>
      </tr>`
    : "";

  const balanceSection = isDeposit && balanceDue
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td style="background:#fff7ed;border-left:3px solid #f97316;border-radius:0 4px 4px 0;padding:12px 16px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#9a3412;">Balance Due: ₹${balanceDue}</p>
            <p style="margin:0;font-size:12px;color:#c2410c;">Due by ${balanceDueDate ?? "—"} · Pay before travel to avoid cancellation</p>
          </td>
        </tr>
      </table>`
    : "";

  const txDetails = transactionId
    ? `<p style="margin:4px 0 0;font-size:12px;color:${TEXT_MUTED};">Transaction ID: ${transactionId}</p>`
    : "";

  const methodBadge = paymentMethod
    ? `<span style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:2px 8px;font-size:11px;color:#166534;font-weight:600;margin-left:8px;">${paymentMethod.toUpperCase()}</span>`
    : "";

  const content = `
    <!-- Receipt Header -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="font-size:12px;color:${TEXT_MUTED};">
          <strong style="color:${BRAND_DARK};">Booking #${bookingNumber}</strong>
        </td>
        <td style="font-size:12px;color:${TEXT_MUTED};text-align:right;">${paidAt}</td>
      </tr>
    </table>

    <!-- Status Banner -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;margin-bottom:12px;">✓</div>
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#16a34a;letter-spacing:1px;text-transform:uppercase;">${isDeposit ? "Deposit Confirmed" : "Payment Confirmed"}</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Your trip is booked, ${customerName}!</h1>
    </div>

    <!-- Trip Info Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_LIGHT};border:1px solid ${BORDER_COLOR};border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:13px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;">Package</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${BRAND_DARK};">${packageName}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:50%;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;">Destination</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">${destination}</p>
              </td>
              <td style="width:50%;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;">Travel Date</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">${travelDate}</p>
              </td>
            </tr>
            <tr><td colspan="2" style="padding-top:10px;"></td></tr>
            <tr>
              <td style="vertical-align:top;">
                <p style="margin:0 0 2px;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;">Duration</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">${duration}</p>
              </td>
              <td style="vertical-align:top;">
                <p style="margin:0 0 2px;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;">Travellers</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">${travellers} ${travellers === 1 ? "Person" : "People"}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Payment Summary -->
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${BRAND_DARK};text-transform:uppercase;letter-spacing:0.5px;">Payment Summary</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
      <tr>
        <td style="font-size:11px;font-weight:600;color:${TEXT_MUTED};text-transform:uppercase;padding-bottom:8px;border-bottom:2px solid ${BORDER_COLOR};">Item</td>
        <td style="font-size:11px;font-weight:600;color:${TEXT_MUTED};text-transform:uppercase;padding-bottom:8px;border-bottom:2px solid ${BORDER_COLOR};text-align:right;">Amount</td>
      </tr>
      ${breakdownRows}
      ${gstRow}
      <tr>
        <td style="padding:10px 0 4px;font-size:14px;color:${TEXT_MUTED};border-bottom:1px solid ${BORDER_COLOR};">Subtotal</td>
        <td style="padding:10px 0 4px;font-size:14px;color:${TEXT_MUTED};text-align:right;border-bottom:1px solid ${BORDER_COLOR};">₹${subtotal}</td>
      </tr>
    </table>

    <!-- Total Paid -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 0;font-size:16px;font-weight:700;color:${BRAND_DARK};">
          ${isDeposit ? "Deposit Paid" : "Total Paid"} ${methodBadge}
        </td>
        <td style="padding:14px 0;font-size:20px;font-weight:700;color:${BRAND_RED};text-align:right;">₹${amountPaid}</td>
      </tr>
    </table>

    ${balanceSection}

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td style="border-top:1px dashed ${BORDER_COLOR};"></td></tr>
    </table>

    <!-- Transaction Details -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:12px;color:${TEXT_MUTED};">Booking Reference</p>
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND_DARK};letter-spacing:2px;font-family:monospace;">${bookingNumber}</p>
          ${txDetails}
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0 0 4px;font-size:12px;color:${TEXT_MUTED};">Support</p>
          <a href="mailto:support@dreamsyatri.com" style="font-size:12px;color:${BRAND_RED};text-decoration:none;">support@dreamsyatri.com</a>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr><td style="border-top:1px dashed ${BORDER_COLOR};"></td></tr>
    </table>

    <!-- Barcode-style reference strip -->
    <div style="text-align:center;padding:16px 0 0;">
      <p style="margin:0 0 6px;font-size:9px;color:${TEXT_MUTED};letter-spacing:1px;text-transform:uppercase;">Booking Reference</p>
      <p style="margin:0;font-size:11px;font-family:monospace;letter-spacing:6px;color:${BRAND_DARK};font-weight:700;">${bookingNumber}</p>
      <!-- Barcode visual -->
      <div style="margin:8px auto 0;width:240px;height:40px;background:repeating-linear-gradient(90deg,#111 0px,#111 2px,#fff 2px,#fff 4px,#111 4px,#111 5px,#fff 5px,#fff 8px,#111 8px,#111 11px,#fff 11px,#fff 13px,#111 13px,#111 14px,#fff 14px,#fff 17px,#111 17px,#111 19px,#fff 19px,#fff 21px,#111 21px,#111 23px,#fff 23px,#fff 26px,#111 26px,#111 28px,#fff 28px,#fff 31px,#111 31px,#111 32px,#fff 32px,#fff 35px,#111 35px,#111 38px,#fff 38px,#fff 40px,#111 40px,#111 42px,#fff 42px,#fff 44px);border-radius:2px;"></div>
    </div>
  `;

  return baseTemplate(content);
}

export function magicLinkEmailTemplate(url: string): string {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${PRE_HEADING};letter-spacing:1px;text-transform:uppercase;">Sign In Link</p>
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
          <a href='${url}' style="margin:0;font-size:12px;color:oklch(62.3% 0.214 259.815);word-break:break-all;">${url}</a>
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