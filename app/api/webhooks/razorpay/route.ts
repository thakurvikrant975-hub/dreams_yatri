import { NextResponse } from "next/server";
import { processGatewayWebhook } from "@/app/actions/payment/webhook.service";

// Node runtime + dynamic: we need the RAW body for HMAC verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const rawBody = await req.text(); // MUST be raw — do not JSON-parse before verifying
    const outcome = await processGatewayWebhook("RAZORPAY", rawBody, req.headers);
    return NextResponse.json({ result: outcome.result }, { status: outcome.httpStatus });
}
