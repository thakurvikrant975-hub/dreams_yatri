import "server-only";

export async function sendWhatsappOtp(phone: string, otp: number): Promise<boolean> {
  const authKey    = process.env.MSG91_API_KEY;
  const templateId = process.env.MSG91_WA_TEMPLATE_ID;
  const isDev      = process.env.NODE_ENV === "development";

  // Dev fallback: log OTP to console so the flow is testable without MSG91 WhatsApp setup
  if (isDev && (!authKey || !templateId)) {
    console.log(`\n[DEV] WhatsApp OTP ──────────────────`);
    console.log(`  Phone : ${phone}`);
    console.log(`  OTP   : ${otp}`);
    console.log(`──────────────────────────────────────\n`);
    return true;
  }

  if (!authKey) {
    console.warn("[sendWhatsappOtp] MSG91_API_KEY is not set");
    return false;
  }
  if (!templateId) {
    console.warn("[sendWhatsappOtp] MSG91_WA_TEMPLATE_ID is not set — WhatsApp OTP disabled");
    return false;
  }

  // MSG91 expects mobile without leading +
  const mobile = phone.replace(/^\+/, "");

  try {
    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/otp", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({ mobile, otp: String(otp), template_id: templateId }),
    });

    const data = await res.json();

    if (!res.ok || data.type === "error") {
      console.error("[sendWhatsappOtp] MSG91 error:", data?.message ?? data);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[sendWhatsappOtp] fetch failed:", err);
    return false;
  }
}
