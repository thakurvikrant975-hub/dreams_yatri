import "server-only";
import { NextResponse } from "next/server";
import {
  getAblyRest, verificationCountsChannelName, salesAgentChannelName, memberNotificationsChannelName,
} from "@/app/lib/ably";
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";

/**
 * Mints a short-lived, subscribe-only Ably token for dashboard team members —
 * the shared verification-counts channel (Verify Hotels / Verify Cabs live
 * "pending" badge) plus this member's own private notifications channel (the
 * header bell). Lives under /dashboard/api/... (not /api/...) on purpose: the
 * dashboard session cookie is scoped to Path=/dashboard (auth-dashboard.ts),
 * so a route outside that path never sees it.
 *
 * The notifications channel is scoped to THIS member's id, resolved from the
 * server-side session rather than trusted from the request — granting it
 * here (not client-chosen) is what keeps one member from ever subscribing to
 * another's channel.
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

    const tokenRequest = await rest.auth.createTokenRequest({
        clientId: `member:${member.id}`,
        capability: {
            // Shared: the Verify Hotels / Verify Cabs pending badge.
            [verificationCountsChannelName()]: ["subscribe"],
            // Private, keyed by this member's own id, so the capability itself
            // is what stops one exec subscribing to another's landings or
            // notifications rather than a check in the client.
            [salesAgentChannelName(member.id)]: ["subscribe"],
            [memberNotificationsChannelName(member.id)]: ["subscribe"],
        },
        ttl: 60 * 60 * 1000, // 1 hour — the client SDK re-requests on expiry
    });

    return NextResponse.json(tokenRequest);
}
