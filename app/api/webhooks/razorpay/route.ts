import { NextResponse } from "next/server";
import { processRazorpayWebhook } from "@/app/actions/payment/webhook.service";

// Node runtime + dynamic: we need the RAW body for HMAC verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const rawBody = await req.text(); // MUST be raw — do not JSON-parse before verifying
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const eventId = req.headers.get("x-razorpay-event-id");

    const outcome = await processRazorpayWebhook({ rawBody, signature, eventId });
    return NextResponse.json({ result: outcome.result }, { status: outcome.httpStatus });
}
