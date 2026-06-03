import { NextResponse } from "next/server";
import { processGatewayWebhook } from "@/app/actions/payment/webhook.service";

// PayU server-to-server notification (form-urlencoded). Need the RAW body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const rawBody = await req.text();
    const outcome = await processGatewayWebhook("PAYU", rawBody, req.headers);
    return NextResponse.json({ result: outcome.result }, { status: outcome.httpStatus });
}
