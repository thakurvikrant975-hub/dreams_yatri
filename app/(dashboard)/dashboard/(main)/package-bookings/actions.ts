"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { getCurrentMember } from "../lib/get-current-member";
import { getProvider } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { finalizeCapturedPayment } from "@/app/actions/payment/finalize.service";
import { cancelBooking, previewCancellation } from "@/app/actions/payment/cancel-booking.service";
import type { CancellationPreview } from "@/app/actions/payment/types";

/**
 * Admin (back-office) actions for package bookings.
 *
 * Gate: a logged-in, active team member — the dashboard's actual security
 * boundary (the layout requires a member; finer-grained RBAC can be layered on
 * by registering a "bookings" resource later). Every mutation is written to the
 * BookingTimeline for an audit trail, attributed to the acting member.
 */

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

function revalidate(bookingId: string) {
    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
}

// ── Cancellation ───────────────────────────────────────────────────────────────

export async function adminPreviewCancellation(
    bookingId: string,
): Promise<{ success: true; preview: CancellationPreview } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };
    const preview = await previewCancellation(bookingId); // admin: no owner scope
    if (!preview) return { success: false, error: "Booking not found." };
    return { success: true, preview };
}

export async function adminCancelBooking(
    bookingId: string,
    reason?: string,
): Promise<{ success: true; refundPct: number; refundablePaise: number; feePaise: number; alreadyCancelled: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const before = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });

    const res = await cancelBooking({ bookingId, reason: reason?.trim() || undefined }); // admin: no byUserId
    if (!res.success) {
        const msg =
            res.reason === "not_found" ? "Booking not found."
            : res.reason === "not_cancellable" ? res.message ?? "This booking can't be cancelled."
            : res.message ?? "Could not cancel the booking.";
        return { success: false, error: msg };
    }

    if (!res.alreadyCancelled) {
        try {
            const note = `Cancelled by ${gate.member.name}.${reason?.trim() ? ` Reason: ${reason.trim()}.` : ""} Refund ${res.refundPct}% = ${formatPaiseRoundedUp(res.refundablePaise)} (fee ${formatPaiseRoundedUp(res.feePaise)}).`;
            await db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: res.refundablePaise > 0 ? "REFUND_INITIATED" : "STATUS_CHANGED",
                    fromStatus: before?.status ?? null,
                    toStatus: "CANCELLED",
                    note,
                    performedById: gate.member.id,
                    performedByName: gate.member.name,
                    departmentId: gate.member.department?.id ?? null,
                },
            });
        } catch (e) {
            console.error("[adminCancelBooking] timeline write failed", e);
        }
    }

    revalidate(bookingId);
    return { success: true, refundPct: res.refundPct, refundablePaise: res.refundablePaise, feePaise: res.feePaise, alreadyCancelled: res.alreadyCancelled };
}

// ── Payment status sync (per-booking reconcile against the gateway) ─────────────

export async function adminSyncPayments(
    bookingId: string,
): Promise<{ success: true; finalized: number; failed: number; skipped: number } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const pendings = await db.payment.findMany({
        where: { bookingId, status: "PENDING", gatewayOrderId: { not: null } },
        select: { id: true, gateway: true, gatewayOrderId: true },
    });
    if (pendings.length === 0) return { success: false, error: "No pending payments to sync." };

    let finalized = 0, failed = 0, skipped = 0;
    for (const p of pendings) {
        try {
            const status = await getProvider(p.gateway as GatewayId).fetchChargeStatus(p.gatewayOrderId!);
            if (status.state === "captured" && status.gatewayPaymentId) {
                await db.$transaction((tx) =>
                    finalizeCapturedPayment(tx, {
                        paymentId: p.id,
                        gatewayPaymentId: status.gatewayPaymentId!,
                        method: status.method ?? null,
                        webhookEventId: null,
                    }),
                );
                finalized++;
            } else if (status.state === "failed") {
                await db.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "admin sync: no successful payment" } });
                failed++;
            } else {
                skipped++;
            }
        } catch (e) {
            console.error("[adminSyncPayments]", p.gateway, p.gatewayOrderId, e);
            skipped++;
        }
    }

    if (finalized > 0 || failed > 0) {
        try {
            await db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: "NOTE_ADDED",
                    note: `Payment status synced by ${gate.member.name}: ${finalized} confirmed, ${failed} failed${skipped ? `, ${skipped} unchanged` : ""}.`,
                    performedById: gate.member.id,
                    performedByName: gate.member.name,
                    departmentId: gate.member.department?.id ?? null,
                },
            });
        } catch (e) {
            console.error("[adminSyncPayments] timeline write failed", e);
        }
    }

    revalidate(bookingId);
    return { success: true, finalized, failed, skipped };
}
