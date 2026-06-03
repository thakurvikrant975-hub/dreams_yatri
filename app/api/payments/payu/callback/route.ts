import { NextResponse } from "next/server";
import { processGatewayWebhook } from "@/app/actions/payment/webhook.service";

// PayU posts the result (form-urlencoded) to surl/furl. We need the RAW body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const rawBody = await req.text();
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("b");

    // Verify + finalize via the shared processor (idempotent; webhook may also fire).
    try {
        await processGatewayWebhook("PAYU", rawBody, req.headers);
    } catch (e) {
        console.error("[payu callback] processing failed", e);
    }

    // Always send the user to the confirmation page (truth shown there; it polls).
    const dest = bookingId ? `/bookings/${bookingId}` : "/packages";
    return NextResponse.redirect(new URL(dest, req.url), { status: 303 });
}
