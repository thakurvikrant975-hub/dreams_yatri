"use server";

/**
 * Manual payment-proof workflow layered on top of the existing Booking/
 * Payment pipeline — a sales exec's GPay/UPI screenshot for a customer who
 * paid outside the website checkout, submitted here for ops sign-off.
 *
 * Deliberately reuses the Booking row that's already auto-created (see
 * tryCreateBookingFromConvertedQuery) the moment a sales query is closed as
 * Converted, rather than a parallel model — every payment submitted here is
 * just a Payment row with gateway = OFFLINE and a proof screenshot attached,
 * same table the Razorpay flow already writes to.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import type { Prisma, PaymentPurpose } from "@/app/generated/prisma";
import { getCurrentMember, getEffectiveMember } from "../lib/get-current-member";
import { isOperationsManagerRole } from "@/app/lib/sales-teams/leader-scope";
import { logTimeline } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { notifyMember } from "@/app/services/notifications/notify";
import { publishBookingWon } from "@/app/lib/ably";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { tryCreateBookingFromConvertedQuery } from "@/app/lib/bookings/create-from-query";

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

// Same "a selling role reaches only its own bookings; a team leader or any
// non-selling role oversees all of it" rule the detail page and list already
// enforce (see package-bookings/[id]/page.tsx) — repeated here because a
// server action can't rely on a page having already checked it.
async function requireSubmitAccess(booking: { salesAgentId: string | null }): Promise<Member | null> {
    const effective = await getEffectiveMember();
    if (!effective) return null;
    const roleName = (effective.member.teamRole?.name ?? "").trim().toLowerCase();
    const sells = roleName.includes("sales") || roleName.includes("travel expert");
    const oversees = roleName.includes("team leader");
    const allowed = !sells || oversees || booking.salesAgentId === effective.member.id;
    return allowed ? effective.member : null;
}

// ── Sales exec: the "New Booking Request" picker ────────────────────────────
//
// A Booking only exists once tryCreateBookingFromConvertedQuery has run,
// which today happens silently at query-close time and can fail quietly
// (no destination match, no travel date on file) — leaving an exec with a
// Converted query and no obvious way in. This picker gives them an explicit
// entry point.
//
// Crucially, it picks a PACKAGE, not just a query: a query can have several
// packages built for it at different prices (see custom_packages' own doc
// comment), and CustomPackageStatus.ACCEPTED — the field that's supposed to
// record which one the client actually went with — was defined in the schema
// but never once written anywhere in the app; the booking-creation heuristic
// only ever *read* it, silently falling back to "most recently sent" when
// nothing was marked. Selecting a row here is what actually sets it, so ops
// reviewing a payment proof can see exactly which package (and price) it's
// for instead of a guess.

export type BookablePackageRow = {
    queryId: string;
    clientName: string;
    destination: string | null;
    /** Null only for a query with no package built at all — still bookable
     * (tryCreateBookingFromConvertedQuery falls back to the query's own
     * destination/group size), just with nothing to disambiguate. */
    packageId: string | null;
    packageTitle: string;
    price: number | null;
    currency: string;
    /** Set once a Booking already exists for this query — the choice is
     * locked in; the row becomes a "jump to it" link rather than a picker. */
    bookingId: string | null;
    bookingNumber: string | null;
    bookingStatus: string | null;
};

export async function getBookablePackages(): Promise<BookablePackageRow[]> {
    const effective = await getEffectiveMember();
    if (!effective) return [];
    const roleName = (effective.member.teamRole?.name ?? "").trim().toLowerCase();
    const sells = roleName.includes("sales") || roleName.includes("travel expert");
    const oversees = roleName.includes("team leader");

    // Same scoping rule as everywhere else in this workflow: a selling role
    // sees only what's assigned to them, a team leader or non-selling role
    // (ops, admin) sees the whole desk.
    const scopeWhere: Prisma.package_queriesWhereInput =
        sells && !oversees ? { assignedTo: effective.member.id } : {};

    const queries = await db.package_queries.findMany({
        where: { ...scopeWhere, status: "CONVERTED", deletedAt: null },
        orderBy: { closedAt: "desc" },
        select: {
            id: true,
            name: true,
            destination: true,
            booking: { select: { id: true, bookingNumber: true, status: true, packageUrl: true } },
            custom_packages: {
                where: { status: { in: ["SENT", "ACCEPTED"] } },
                orderBy: { sentAt: "desc" },
                select: { id: true, title: true, destination: true, totalPrice: true, currency: true, status: true },
            },
        },
    });

    const rows: BookablePackageRow[] = [];
    for (const q of queries) {
        if (q.booking) {
            // Already requested — one row, not a re-pick. Identify which
            // package it was pinned to (packageUrl carries the id) so the
            // row still shows something meaningful instead of "Package".
            const pinnedId = q.booking.packageUrl?.match(/^\/custom-package\/([^/?#]+)/)?.[1];
            const pinned = q.custom_packages.find((p) => p.id === pinnedId)
                ?? q.custom_packages.find((p) => p.status === "ACCEPTED")
                ?? null;
            rows.push({
                queryId: q.id,
                clientName: q.name,
                destination: pinned?.destination ?? q.destination,
                packageId: pinned?.id ?? null,
                packageTitle: pinned?.title ?? q.destination ?? "Package",
                price: pinned?.totalPrice ?? null,
                currency: pinned?.currency ?? "INR",
                bookingId: q.booking.id,
                bookingNumber: q.booking.bookingNumber,
                bookingStatus: q.booking.status,
            });
            continue;
        }

        if (q.custom_packages.length === 0) {
            rows.push({
                queryId: q.id, clientName: q.name, destination: q.destination,
                packageId: null, packageTitle: q.destination ?? "Package", price: null, currency: "INR",
                bookingId: null, bookingNumber: null, bookingStatus: null,
            });
            continue;
        }

        // No booking yet — every candidate package gets its own row so the
        // exec picks the exact one, instead of the system guessing.
        for (const cp of q.custom_packages) {
            rows.push({
                queryId: q.id,
                clientName: q.name,
                destination: cp.destination ?? q.destination,
                packageId: cp.id,
                packageTitle: cp.title,
                price: cp.totalPrice ?? null,
                currency: cp.currency,
                bookingId: null,
                bookingNumber: null,
                bookingStatus: null,
            });
        }
    }
    return rows;
}

/** Jump to an existing booking, or create one — pinned to the chosen package,
 * if one was picked — on the spot if auto-creation never ran (or silently
 * failed) at query-close time. */
export async function requestBooking(
    queryId: string,
    packageId?: string | null,
): Promise<{ success: boolean; bookingId?: string; message: string }> {
    const effective = await getEffectiveMember();
    if (!effective) return { success: false, message: "Not authenticated." };

    const query = await db.package_queries.findUnique({
        where: { id: queryId },
        select: { id: true, assignedTo: true, status: true, booking: { select: { id: true } } },
    });
    if (!query) return { success: false, message: "Query not found." };
    if (query.status !== "CONVERTED") return { success: false, message: "This query hasn't been converted yet." };

    const roleName = (effective.member.teamRole?.name ?? "").trim().toLowerCase();
    const sells = roleName.includes("sales") || roleName.includes("travel expert");
    const oversees = roleName.includes("team leader");
    if (sells && !oversees && query.assignedTo !== effective.member.id) {
        return { success: false, message: "You don't have access to this query." };
    }

    if (query.booking) return { success: true, bookingId: query.booking.id, message: "Booking found." };

    if (packageId) {
        const pkg = await db.custom_packages.findUnique({ where: { id: packageId }, select: { queryId: true } });
        if (!pkg || pkg.queryId !== queryId) return { success: false, message: "That package doesn't belong to this query." };

        // Mark the winner ACCEPTED and every other candidate DECLINED —
        // tryCreateBookingFromConvertedQuery re-reads this straight after,
        // so getting this write in first is what pins the booking to the
        // right package without needing its own packageId parameter.
        const siblings = await db.custom_packages.findMany({
            where: { queryId, id: { not: packageId }, status: { in: ["SENT", "ACCEPTED"] } },
            select: { id: true },
        });
        await db.$transaction([
            db.custom_packages.update({ where: { id: packageId }, data: { status: "ACCEPTED" } }),
            ...(siblings.length > 0
                ? [db.custom_packages.updateMany({ where: { id: { in: siblings.map((s) => s.id) } }, data: { status: "DECLINED" } })]
                : []),
        ]);
    }

    const result = await tryCreateBookingFromConvertedQuery(queryId, effective.member.id, effective.member.name);
    if (!result.created) return { success: false, message: result.reason };

    revalidatePath("/dashboard/package-bookings");
    return { success: true, bookingId: result.bookingId, message: "Booking created." };
}

function inr(paise: number): string {
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

// ── Sales exec: submit proof ────────────────────────────────────────────────

export type PaymentProofInput = {
    /** Rupees, not paise — matches what the exec actually typed. */
    amount: number;
    proofUrl: string;
    proofKey: string;
    /** ISO date the customer actually paid, not today. */
    paidAt: string;
    method?: "UPI" | "CASH";
};

export async function submitPaymentProof(
    bookingId: string,
    payments: PaymentProofInput[],
): Promise<{ success: boolean; message: string }> {
    const valid = payments.filter((p) => p.amount > 0 && p.proofUrl);
    if (valid.length === 0) return { success: false, message: "Add at least one payment with a screenshot." };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, bookingNumber: true, salesAgentId: true, userId: true,
            currency: true, status: true, sourceQueryId: true,
        },
    });
    if (!booking) return { success: false, message: "Booking not found." };
    if (booking.status === "CANCELLED") return { success: false, message: "This booking is cancelled." };

    const member = await requireSubmitAccess(booking);
    if (!member) return { success: false, message: "You don't have access to this booking." };

    // First-ever payment on this booking is the deposit; anything after is
    // toward the balance. Only matters for the Payments table's "Purpose"
    // column — the approval math below sums every non-rejected payment
    // regardless of purpose.
    const priorCount = await db.payment.count({
        where: { bookingId, verificationStatus: { not: "REJECTED" } },
    });

    const totalPaise = valid.reduce((sum, p) => sum + Math.round(p.amount * 100), 0);

    const data: Prisma.PaymentCreateManyInput[] = valid.map((p, i) => {
        const purpose: PaymentPurpose = priorCount + i === 0 ? "INITIAL" : "BALANCE";
        return {
            bookingId,
            userId: booking.userId,
            amount: p.amount,
            amount_paise: Math.round(p.amount * 100),
            currency: booking.currency,
            gateway: "OFFLINE",
            method: p.method ?? "UPI",
            status: "PENDING",
            verificationStatus: "PENDING_REVIEW",
            purpose,
            paidAt: new Date(p.paidAt),
            proofUrl: p.proofUrl,
            proofKey: p.proofKey,
            submittedById: member.id,
            submittedByName: member.name,
        };
    });
    await db.payment.createMany({ data });

    await db.bookingTimeline.create({
        data: {
            bookingId,
            action: "NOTE_ADDED",
            note: `💳 Payment proof submitted by ${member.name} — ${inr(totalPaise)} pending ops review (${valid.length} payment${valid.length !== 1 ? "s" : ""}).`,
            performedById: member.id,
            performedByName: member.name,
        },
    });

    if (booking.sourceQueryId) {
        await logTimeline(
            booking.sourceQueryId,
            `💳 Payment proof submitted for booking ${booking.bookingNumber} — pending ops review`,
            member.id,
            member.name,
        );
    }

    const opsManagers = await db.teamMember.findMany({
        where: { isActive: true, teamRole: { name: { contains: "Operations Manager", mode: "insensitive" } } },
        select: { id: true },
    });
    await Promise.all(opsManagers.map((m) => notifyMember({
        recipientId: m.id,
        type: "BOOKING_PAYMENT_PROOF_SUBMITTED",
        title: `Payment proof submitted — ${booking.bookingNumber}`,
        body: `${member.name} submitted ${inr(totalPaise)} in payment proof for review.`,
        link: `/dashboard/package-bookings/${bookingId}`,
    })));

    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath("/dashboard/package-bookings");

    return { success: true, message: "Payment proof submitted for approval." };
}

// ── Ops: approve / reject ───────────────────────────────────────────────────

export async function approveBookingPayments(bookingId: string): Promise<{ success: boolean; message: string }> {
    if (!(await isOperationsManagerRole())) return { success: false, message: "Only Operations can approve payments." };
    const member = await getCurrentMember();
    if (!member) return { success: false, message: "Not authenticated." };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, bookingNumber: true, status: true, salesAgentId: true, sourceQueryId: true,
            totalAmount_paise: true, currency: true,
            package: { select: { title: true } },
            destination: { select: { name: true } },
            user: { select: { name: true } },
            payments: { select: { id: true, amount_paise: true, verificationStatus: true } },
        },
    });
    if (!booking) return { success: false, message: "Booking not found." };
    if (booking.status === "CANCELLED") return { success: false, message: "This booking is cancelled." };

    const pending = booking.payments.filter((p) => p.verificationStatus === "PENDING_REVIEW");
    if (pending.length === 0) return { success: false, message: "No payment proofs awaiting review." };

    const now = new Date();
    const prevStatus = booking.status;
    const paidPaise = booking.payments
        .filter((p) => p.verificationStatus === "APPROVED" || pending.some((pp) => pp.id === p.id))
        .reduce((sum, p) => sum + p.amount_paise, 0);
    const balancePaise = Math.max(0, booking.totalAmount_paise - paidPaise);
    const rupees = (paise: number) => (paise / 100).toFixed(2);

    await db.$transaction([
        db.payment.updateMany({
            where: { id: { in: pending.map((p) => p.id) } },
            data: {
                verificationStatus: "APPROVED",
                status: "FULLY_PAID",
                verifiedById: member.id,
                verifiedByName: member.name,
                verifiedAt: now,
            },
        }),
        db.booking.update({
            where: { id: bookingId },
            data: {
                status: "CONFIRMED",
                paymentStatus: paidPaise >= booking.totalAmount_paise ? "FULLY_PAID" : "ADVANCE_PAID",
                paidAmount: rupees(paidPaise),
                // advancePaidAmount deliberately untouched — these manually-
                // created bookings (see tryCreateBookingFromConvertedQuery)
                // never get a deposit/balance paymentPlan set up, so there's
                // no "advance vs balance" split to preserve here the way
                // finalizeCapturedPayment does for the gateway flow.
                balanceDueAmount: rupees(balancePaise),
                balanceAmount_paise: balancePaise,
            },
        }),
        db.bookingTimeline.create({
            data: {
                bookingId,
                action: "STATUS_CHANGED",
                fromStatus: prevStatus,
                toStatus: "CONFIRMED",
                note: `✅ Payment verified by ${member.name} — booking confirmed.`,
                performedById: member.id,
                performedByName: member.name,
            },
        }),
    ]);

    if (booking.sourceQueryId) {
        await logTimeline(
            booking.sourceQueryId,
            `✅ Payment verified — booking confirmed (${booking.bookingNumber})`,
            member.id,
            member.name,
            { bookingId },
        );
    }

    if (booking.salesAgentId) {
        await notifyMember({
            recipientId: booking.salesAgentId,
            type: "BOOKING_PAYMENT_APPROVED",
            title: `Payment approved — ${booking.bookingNumber}`,
            body: "Your payment proof was verified. The booking is now confirmed.",
            link: `/dashboard/package-bookings/${bookingId}`,
        });

        // The celebration, live — same event BookingWonToast already listens
        // for, so this reuses that toast for free; the bigger celebration
        // popup (BookingCelebrationDialog) subscribes to the same event too.
        await publishBookingWon(booking.salesAgentId, {
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            packageTitle: booking.package?.title ?? booking.destination?.name ?? "your trip",
            clientName: booking.user?.name ?? null,
            amountPaise: booking.totalAmount_paise,
            currency: booking.currency,
        });
    }

    await broadcastVerificationCounts();
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath("/dashboard/package-bookings");

    return { success: true, message: "Payment approved — booking confirmed." };
}

export async function rejectBookingPayments(bookingId: string, reason: string): Promise<{ success: boolean; message: string }> {
    if (!(await isOperationsManagerRole())) return { success: false, message: "Only Operations can reject payments." };
    const trimmedReason = reason.trim();
    if (!trimmedReason) return { success: false, message: "A reason is required." };

    const member = await getCurrentMember();
    if (!member) return { success: false, message: "Not authenticated." };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, bookingNumber: true, salesAgentId: true, sourceQueryId: true,
            payments: { where: { verificationStatus: "PENDING_REVIEW" }, select: { id: true } },
        },
    });
    if (!booking) return { success: false, message: "Booking not found." };
    if (booking.payments.length === 0) return { success: false, message: "No payment proofs awaiting review." };

    const now = new Date();
    await db.payment.updateMany({
        where: { id: { in: booking.payments.map((p) => p.id) } },
        data: {
            verificationStatus: "REJECTED",
            status: "FAILED",
            rejectionReason: trimmedReason,
            verifiedById: member.id,
            verifiedByName: member.name,
            verifiedAt: now,
        },
    });

    await db.bookingTimeline.create({
        data: {
            bookingId,
            action: "NOTE_ADDED",
            note: `❌ Payment proof rejected by ${member.name} — ${trimmedReason}`,
            performedById: member.id,
            performedByName: member.name,
        },
    });

    if (booking.sourceQueryId) {
        await logTimeline(booking.sourceQueryId, `❌ Payment proof rejected — ${trimmedReason}`, member.id, member.name);
    }

    if (booking.salesAgentId) {
        await notifyMember({
            recipientId: booking.salesAgentId,
            type: "BOOKING_PAYMENT_REJECTED",
            title: `Payment proof rejected — ${booking.bookingNumber}`,
            body: trimmedReason,
            link: `/dashboard/package-bookings/${bookingId}`,
        });
    }

    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath("/dashboard/package-bookings");

    return { success: true, message: "Payment proof rejected." };
}

// ── Celebration + party ─────────────────────────────────────────────────────

export type UnseenCelebration = {
    id: string;
    bookingNumber: string;
    packageTitle: string;
    clientName: string | null;
    amountPaise: number;
    currency: string;
};

/** Covers the exec not having the dashboard open at the moment ops approved
 * — checked once on their next page load so the celebration still fires
 * exactly once, just not live. */
export async function getUnseenCelebration(): Promise<UnseenCelebration | null> {
    const member = await getCurrentMember();
    if (!member) return null;

    const booking = await db.booking.findFirst({
        where: { salesAgentId: member.id, status: "CONFIRMED", celebrationSeenAt: null },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true, bookingNumber: true, totalAmount_paise: true, currency: true,
            package: { select: { title: true } },
            destination: { select: { name: true } },
            user: { select: { name: true } },
        },
    });
    if (!booking) return null;

    return {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        packageTitle: booking.package?.title ?? booking.destination?.name ?? "your trip",
        clientName: booking.user?.name ?? null,
        amountPaise: booking.totalAmount_paise,
        currency: booking.currency,
    };
}

export async function markCelebrationSeen(bookingId: string): Promise<{ success: boolean }> {
    const member = await getCurrentMember();
    if (!member) return { success: false };
    const res = await db.booking.updateMany({
        where: { id: bookingId, salesAgentId: member.id },
        data: { celebrationSeenAt: new Date() },
    });
    return { success: res.count > 0 };
}

export async function requestParty(bookingId: string): Promise<{ success: boolean; message: string }> {
    const member = await getCurrentMember();
    if (!member) return { success: false, message: "Not authenticated." };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, bookingNumber: true, salesAgentId: true, partyRequested: true },
    });
    if (!booking || booking.salesAgentId !== member.id) return { success: false, message: "Booking not found." };
    if (booking.partyRequested) return { success: true, message: "Already sent!" };

    await db.booking.update({
        where: { id: bookingId },
        data: { partyRequested: true, partyAskedAt: new Date() },
    });

    // Their own Team Leader if they have one, otherwise every Sales Manager —
    // same fallback shape as getPackageReviewScope's "team vs company" split.
    const me = await db.teamMember.findUnique({
        where: { id: member.id },
        select: { salesTeam: { select: { leaderId: true } } },
    });
    const leaderId = me?.salesTeam?.leaderId ?? null;

    const recipientIds = leaderId
        ? [leaderId]
        : (await db.teamMember.findMany({
            where: { isActive: true, teamRole: { name: { contains: "sales manager", mode: "insensitive" } } },
            select: { id: true },
        })).map((m) => m.id);

    await Promise.all(recipientIds.map((id) => notifyMember({
        recipientId: id,
        type: "BOOKING_PARTY_REQUEST",
        title: `🎉 ${member.name} wants to celebrate!`,
        body: `They just closed booking ${booking.bookingNumber} and would love to plan a small celebration for it.`,
        link: `/dashboard/package-bookings/${bookingId}`,
    })));

    return { success: true, message: "Sent to your team!" };
}
