"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { logTimeline, getCurrentActor } from "../(marketing)/queries/actions";
import { createLog } from "../lib/logger";
import { notifyMember } from "@/app/services/notifications/notify";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";

/** Who should hear about a freshly submitted reopen request — every active
 * member whose role can see the Reopen Requests page (empty pageAccess means
 * unrestricted, same rule the sidebar/layout enforce elsewhere), minus the
 * requester themself. No separate "reviewer" role in this schema — page
 * access IS the access-control model here, same as Lead Requests
 * (see lead-requests/actions.ts's getLeadRequestNotifyRecipients). */
async function getReopenRequestNotifyRecipients(excludeId?: string): Promise<string[]> {
    const members = await db.teamMember.findMany({
        where: { isActive: true },
        select: { id: true, teamRole: { select: { pageAccess: true } } },
    });
    return members
        .filter((m) => m.id !== excludeId)
        .filter((m) => {
            const access = Array.isArray(m.teamRole?.pageAccess) ? (m.teamRole!.pageAccess as unknown as string[]) : [];
            return access.length === 0 || access.includes("/dashboard/reopen-requests");
        })
        .map((m) => m.id);
}

// ── Sales exec: submit a request ────────────────────────────────────────────

export async function requestQueryReopen(queryId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const trimmed = reason.trim();
    if (!trimmed) return { success: false, message: "A reason is required to request a reopen" };

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();
        if (!teamMemberId) return { success: false, message: "Unauthorized" };

        const query = await db.package_queries.findUnique({
            where:  { id: queryId },
            select: { id: true, name: true, status: true },
        });
        if (!query) return { success: false, message: "Query not found" };
        if (query.status !== "CLOSED") return { success: false, message: "Only a closed query can be reopened" };

        const existing = await db.queryReopenRequest.findFirst({
            where:  { queryId, status: "PENDING" },
            select: { id: true },
        });
        if (existing) return { success: false, message: "A reopen request for this query is already pending" };

        const request = await db.queryReopenRequest.create({
            data: {
                queryId,
                reason: trimmed,
                requestedById: teamMemberId,
                requestedByName: teamMemberName ?? "Unknown",
            },
        });

        await logTimeline(queryId, `🔓 Reopen requested — "${trimmed}"`, teamMemberId, teamMemberName ?? undefined);

        await createLog({
            action: "CREATE", entity: "query_reopen_request", entityId: request.id, entitySlug: query.name,
            metadata: { operation: "request_query_reopen" },
        });

        const recipients = await getReopenRequestNotifyRecipients(teamMemberId);
        await Promise.all(recipients.map((recipientId) => notifyMember({
            recipientId,
            type: "QUERY_REOPEN_REQUESTED",
            title: `${teamMemberName ?? "A team member"} requested to reopen a query`,
            body: `${query.name} — "${trimmed}"`,
            link: "/dashboard/reopen-requests",
        })));
        await broadcastVerificationCounts();

        revalidatePath("/dashboard/sales-query");
        revalidatePath("/dashboard/reopen-requests");
        return { success: true, message: "Reopen request sent for review" };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Something went wrong" };
    }
}

// ── Reviewer: the review queue ───────────────────────────────────────────────

export type ReopenRequestRow = Awaited<ReturnType<typeof db.queryReopenRequest.findMany>>[number] & {
    query: { id: string; name: string; phone: string; destination: string | null; status: string } | null;
};

export type ReopenRequestsFilter = "all" | "pending" | "approved" | "rejected";
export type ReopenRequestStats = { total: number; pending: number; approved: number; rejected: number };

export async function getReopenRequestsQueue(params: {
    page: number;
    limit: number;
    search: string;
    filter: ReopenRequestsFilter;
}): Promise<{ rows: ReopenRequestRow[]; totalCount: number; stats: ReopenRequestStats }> {
    const { page, limit, search, filter } = params;

    const filterWhere: Prisma.QueryReopenRequestWhereInput =
        filter === "pending" ? { status: "PENDING" } :
        filter === "approved" ? { status: "APPROVED" } :
        filter === "rejected" ? { status: "REJECTED" } :
        {};

    // requestedByName/reason live on this table directly; the query's own
    // name/phone/destination don't (they're on package_queries), so a
    // search first resolves matching query ids and ORs them in.
    let searchWhere: Prisma.QueryReopenRequestWhereInput = {};
    if (search) {
        const matchingQueries = await db.package_queries.findMany({
            where: {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search, mode: "insensitive" } },
                    { destination: { contains: search, mode: "insensitive" } },
                ],
            },
            select: { id: true },
            take: 500,
        });
        const matchingIds = matchingQueries.map((q) => q.id);
        searchWhere = {
            OR: [
                { requestedByName: { contains: search, mode: "insensitive" } },
                { reason: { contains: search, mode: "insensitive" } },
                ...(matchingIds.length > 0 ? [{ queryId: { in: matchingIds } }] : []),
            ],
        };
    }

    const where: Prisma.QueryReopenRequestWhereInput = { ...searchWhere, ...filterWhere };

    const [rows, totalCount, total, pending, approved, rejected] = await Promise.all([
        db.queryReopenRequest.findMany({
            where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit,
        }),
        db.queryReopenRequest.count({ where }),
        db.queryReopenRequest.count(),
        db.queryReopenRequest.count({ where: { status: "PENDING" } }),
        db.queryReopenRequest.count({ where: { status: "APPROVED" } }),
        db.queryReopenRequest.count({ where: { status: "REJECTED" } }),
    ]);

    const queryIds = Array.from(new Set(rows.map((r) => r.queryId)));
    const queries = queryIds.length > 0
        ? await db.package_queries.findMany({
            where:  { id: { in: queryIds } },
            select: { id: true, name: true, phone: true, destination: true, status: true },
        })
        : [];
    const queryById = new Map(queries.map((q) => [q.id, q]));

    const requests = rows.map((r) => ({ ...r, query: queryById.get(r.queryId) ?? null }));

    return { rows: requests, totalCount, stats: { total, pending, approved, rejected } };
}

/** Reviewer jotting a note on a request while it's still in the queue —
 * independent of approve/reject so it isn't lost if they want to think it
 * over first. Mirrors updateLeadRequestReviewNote. */
export async function updateReopenRequestReviewNote(id: string, note: string): Promise<{ success: boolean; error?: string }> {
    try {
        const request = await db.queryReopenRequest.findUnique({ where: { id }, select: { id: true } });
        if (!request) return { success: false, error: "Request not found" };

        await db.queryReopenRequest.update({
            where: { id },
            data: { reviewNote: note.trim() || null },
        });

        revalidatePath("/dashboard/reopen-requests");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Something went wrong" };
    }
}

// ── Approve — the only place a closed query flips back open ────────────────

export async function approveReopenRequest(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();
        if (!teamMemberId) return { success: false, error: "Unauthorized" };

        const request = await db.queryReopenRequest.findUnique({ where: { id } });
        if (!request) return { success: false, error: "Request not found" };
        if (request.status !== "PENDING") return { success: false, error: "Already decided" };

        const query = await db.package_queries.findUnique({
            where:  { id: request.queryId },
            select: { id: true, name: true, booking: { select: { bookingNumber: true, paymentStatus: true } } },
        });
        if (!query) return { success: false, error: "The query no longer exists" };

        // Belt-and-suspenders alongside closeSalesQuery's own guard — a query
        // only reaches CLOSED (reopen-eligible) with a Booking still attached
        // if that booking never had a payment approved, since payment
        // approval doesn't touch query status but closeSalesQuery now refuses
        // to move a CONVERTED query away while a Booking exists at all. Once
        // a payment IS approved, reopening must go through cancelling the
        // booking first rather than silently reactivating the query under it.
        if (query.booking && (query.booking.paymentStatus === "ADVANCE_PAID" || query.booking.paymentStatus === "FULLY_PAID")) {
            return {
                success: false,
                error: `This query's booking (${query.booking.bookingNumber}) has an approved payment — cancel or resolve it in Package Bookings before reopening.`,
            };
        }

        await db.package_queries.update({
            where: { id: request.queryId },
            data: {
                status:           "IN_PROGRESS",
                closeReasonId:    null,
                closeReasonOther: null,
                closedAt:         null,
                closedBy:         null,
            },
        });

        await db.queryReopenRequest.update({
            where: { id },
            data: {
                status: "APPROVED",
                decidedAt: new Date(), decidedById: teamMemberId, decidedByName: teamMemberName ?? "Reviewer",
            },
        });

        await logTimeline(request.queryId, `🔄 Reopen approved by ${teamMemberName ?? "a reviewer"}`, teamMemberId, teamMemberName ?? undefined);

        await notifyMember({
            recipientId: request.requestedById,
            type: "QUERY_REOPEN_APPROVED",
            title: `${query.name} — reopen request approved`,
            body: `The query is reopened and back in your active list.`,
            link: "/dashboard/sales-query",
        });

        await createLog({
            action: "UPDATE", entity: "query_reopen_request", entityId: id, entitySlug: query.name,
            metadata: { operation: "approve_reopen_request" },
        });
        await broadcastVerificationCounts();

        revalidatePath("/dashboard/reopen-requests");
        revalidatePath("/dashboard/sales-query");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Something went wrong" };
    }
}

// ── Reject ───────────────────────────────────────────────────────────────────

export async function rejectReopenRequest(id: string, rejectionReason: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = rejectionReason.trim();
    if (!trimmed) return { success: false, error: "A reason is required to reject a request" };

    try {
        const { teamMemberId, teamMemberName } = await getCurrentActor();
        if (!teamMemberId) return { success: false, error: "Unauthorized" };

        const request = await db.queryReopenRequest.findUnique({ where: { id } });
        if (!request) return { success: false, error: "Request not found" };
        if (request.status !== "PENDING") return { success: false, error: "Already decided" };

        const query = await db.package_queries.findUnique({ where: { id: request.queryId }, select: { name: true } });

        await db.queryReopenRequest.update({
            where: { id },
            data: {
                status: "REJECTED", rejectionReason: trimmed,
                decidedAt: new Date(), decidedById: teamMemberId, decidedByName: teamMemberName ?? "Reviewer",
            },
        });

        await logTimeline(request.queryId, `🔒 Reopen request rejected — "${trimmed}"`, teamMemberId, teamMemberName ?? undefined);

        await notifyMember({
            recipientId: request.requestedById,
            type: "QUERY_REOPEN_REJECTED",
            title: `${query?.name ?? "Query"} — reopen request rejected`,
            body: trimmed,
            link: "/dashboard/sales-query",
        });

        await createLog({
            action: "UPDATE", entity: "query_reopen_request", entityId: id, entitySlug: query?.name,
            metadata: { operation: "reject_reopen_request", reason: trimmed },
        });
        await broadcastVerificationCounts();

        revalidatePath("/dashboard/reopen-requests");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Something went wrong" };
    }
}
