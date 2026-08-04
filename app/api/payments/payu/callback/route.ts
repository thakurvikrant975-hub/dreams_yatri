import { NextResponse } from "next/server";
import { processGatewayWebhook } from "@/app/actions/payment/webhook.service";

// PayU posts the result (form-urlencoded) to surl/furl. We need the RAW body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const rawBody = await req.text();
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("b");
    // furl and surl are distinct URLs differing only by `k` — honour it, or a
    // declined payment silently lands on the confirmation page, which polls for a
    // capture that will never arrive. The pay page derives its own retry banner
    // from the last INITIAL leg being FAILED.
    const failed = url.searchParams.get("k") === "failure";

    // Verify + finalize via the shared processor (idempotent; webhook may also fire).
    try {
        await processGatewayWebhook("PAYU", rawBody, req.headers);
    } catch (e) {
        console.error("[payu callback] processing failed", e);
    }

    const dest = bookingId
        ? (failed ? `/bookings/${bookingId}/pay` : `/bookings/${bookingId}`)
        : "/packages";
    return NextResponse.redirect(new URL(dest, req.url), { status: 303 });
}
