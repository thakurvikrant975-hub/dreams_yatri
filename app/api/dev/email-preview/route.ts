// app/api/dev/email-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { otpEmailTemplate } from "@/app/lib/functions/emailTemplates";
import { magicLinkEmailTemplate } from "@/app/lib/functions/emailTemplates";

// Block in production
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const template = searchParams.get("template");

  let html: string;

  switch (template) {
    case "otp":
      html = otpEmailTemplate(847291);
      break;

    case "magic-link":
      html = magicLinkEmailTemplate("http://localhost:3000/api/auth/magic-link/verify?token=abc123&email=user@example.com");
      break;

    default:
      // Index page — list all available templates
      html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Email Previews – Dreams Yatri</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; min-height: 100vh; padding: 40px 24px; }
            h1 { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 4px; }
            p  { font-size: 14px; color: #6b7280; margin-bottom: 32px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; max-width: 860px; }
            .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; text-decoration: none; display: block; transition: box-shadow 0.15s; }
            .card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
            .tag { display: inline-block; font-size: 11px; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 3px 10px; border-radius: 20px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .card-title { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 6px; }
            .card-desc  { font-size: 13px; color: #6b7280; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>Email Previews</h1>
          <p>Development only — select a template to preview</p>
          <div class="grid">
            <a class="card" href="/api/dev/email-preview?template=otp" target="_blank">
              <span class="tag">Auth</span>
              <p class="card-title">OTP Verification</p>
              <p class="card-desc">Sent when user logs in via phone number.</p>
            </a>
            <a class="card" href="/api/dev/email-preview?template=magic-link" target="_blank">
              <span class="tag">Auth</span>
              <p class="card-title">Magic Link</p>
              <p class="card-desc">Sent when user logs in via email address.</p>
            </a>
          </div>
        </body>
        </html>
      `;
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}