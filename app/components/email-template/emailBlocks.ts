// app/lib/email/components/emailBlocks.ts
// Reusable content blocks — use inside any email body

const BRAND_RED  = "#dc2626";
const TEXT_MUTED = "#6b7280";

// ── Section label e.g. "Verification Code" ─────────────────────────────────
export function EmailLabel(text: string): string {
  return `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND_RED};letter-spacing:1px;text-transform:uppercase;">
      ${text}
    </p>
  `;
}

// ── Main heading ────────────────────────────────────────────────────────────
export function EmailTitle(text: string): string {
  return `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111111;">
      ${text}
    </h1>
  `;
}

// ── Body paragraph ──────────────────────────────────────────────────────────
export function EmailText(text: string): string {
  return `
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      ${text}
    </p>
  `;
}

// ── Muted small text — for disclaimers ─────────────────────────────────────
export function EmailMuted(text: string): string {
  return `
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      ${text}
    </p>
  `;
}

// ── OTP code box ────────────────────────────────────────────────────────────
export function EmailOtpBox(otp: number): string {
  return `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:28px;text-align:center;margin:0 0 28px;">
      <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#111111;">
        ${otp}
      </span>
    </div>
  `;
}

// ── Red alert/info bar ──────────────────────────────────────────────────────
export function EmailAlert(text: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#fef2f2;border-left:3px solid ${BRAND_RED};border-radius:0 4px 4px 0;padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#991b1b;">${text}</p>
        </td>
      </tr>
    </table>
  `;
}

// ── Primary CTA button ──────────────────────────────────────────────────────
export function EmailButton(label: string, url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
      <tr>
        <td align="center">
          <a href="${url}"
            style="display:inline-block;background:${BRAND_RED};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:6px;letter-spacing:0.3px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ── Fallback URL (below CTA button) ────────────────────────────────────────
export function EmailFallbackUrl(url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-top:1px solid #e5e7eb;padding-top:24px;">
          <p style="margin:0 0 6px;font-size:12px;color:${TEXT_MUTED};">
            Button not working? Copy and paste this link into your browser:
          </p>
          <p style="margin:0;font-size:12px;color:${BRAND_RED};word-break:break-all;">
            ${url}
          </p>
        </td>
      </tr>
    </table>
  `;
}

// ── Horizontal divider ──────────────────────────────────────────────────────
export function EmailDivider(): string {
  return `
    <div style="border-top:1px solid #e5e7eb;margin:24px 0;"></div>
  `;
}