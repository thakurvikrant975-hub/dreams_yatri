export async function sendOtpSms(phone: string, otp: number): Promise<boolean> {
  const authKey    = process.env.MSG91_API_KEY!;
  const templateId = process.env.MSG91_TEMPLATE_ID; // optional — omit when empty to use MSG91 default

  // MSG91 expects mobile without leading +
  const mobile = phone.replace(/^\+/, "");

  try {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        ...(templateId ? { template_id: templateId } : {}),
        mobile,
        otp: String(otp),
        // sender intentionally omitted — MSG91 uses default pre-approved sender (no DLT needed)
      }),
    });

    const data = await res.json();

    if (!res.ok || data.type === "error") {
      console.error("[sendOtpSms] MSG91 error:", data?.message ?? data);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[sendOtpSms] fetch failed:", err);
    return false;
  }
}
