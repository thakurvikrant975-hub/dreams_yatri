import "server-only";
import { NextResponse } from "next/server";
import { getAblyRest, verificationCountsChannelName } from "@/app/lib/ably";
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";

/**
 * Mints a short-lived, subscribe-only Ably token for dashboard team members —
 * currently just the shared verification-counts channel (Verify Hotels /
 * Verify Cabs live "pending" badge). Lives under /dashboard/api/... (not
 * /api/...) on purpose: the dashboard session cookie is scoped to
 * Path=/dashboard (auth-dashboard.ts), so a route outside that path never
 * sees it.
 */
export async function POST() {
    const member = await getCurrentMember();
    if (!member || !member.isActive) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const rest = getAblyRest();
    if (!rest) {
        return NextResponse.json({ error: "Live updates are temporarily unavailable." }, { status: 503 });
    }

    const channel = verificationCountsChannelName();
    const tokenRequest = await rest.auth.createTokenRequest({
        clientId: `member:${member.id}`,
        capability: { [channel]: ["subscribe"] },
        ttl: 60 * 60 * 1000, // 1 hour — the client SDK re-requests on expiry
    });

    return NextResponse.json(tokenRequest);
}
