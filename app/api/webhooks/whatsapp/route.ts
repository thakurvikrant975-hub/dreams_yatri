import { NextRequest, NextResponse } from "next/server";
import { isValidWebhookVerifyToken, verifyWebhookSignature } from "@/app/lib/whatsapp";

// Node runtime + dynamic: we need the RAW body for HMAC verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meta's one-time subscription handshake, triggered by "Verify and save" in the dashboard. */
export function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && isValidWebhookVerifyToken(token)) {
        return new NextResponse(challenge ?? "", { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
}

// TODO(next step): persist message status updates / inbound messages / template
// status updates to a WhatsAppMessage log once that Prisma schema exists.
export async function POST(req: NextRequest) {
    const rawBody = await req.text(); // MUST be raw — do not JSON-parse before verifying
    const signature = req.headers.get("x-hub-signature-256");

    if (!verifyWebhookSignature(rawBody, signature)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ received: true });
    }

    console.log("[whatsapp webhook]", JSON.stringify(payload));

    // Meta requires a fast 200 — heavier processing moves off this path once it exists.
    return NextResponse.json({ received: true });
}
