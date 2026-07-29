import "server-only";
import { db } from "@/app/lib/db";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { sendEmail } from "@/app/lib/functions/sendEmail";

/**
 * Balance-due reminders for deposit bookings.
 *
 * Cadence (3 touchpoints): 7 days before due, 1 day before, and an overdue
 * notice once past due. De-duped via `reminderCount` (a monotonic stage marker:
 * 1 = 7-day sent, 2 = 1-day sent, 3 = overdue sent) so each touchpoint fires at
 * most once even if the cron runs many times a day. Past-due also flips the
 * installment to OVERDUE. The mailer is injectable for tests.
 */

export type Mailer = (args: { to: string; subject: string; html: string }) => Promise<boolean>;

export interface ReminderSummary {
    scanned: number;
    remindersSent: number;
    markedOverdue: number;
}

type Stage = "due7" | "due1" | "overdue" | null;

function calMs(y: number, mIdx: number, d: number) { return Date.UTC(y, mIdx, d); }

function stageFor(due: Date, now: Date): { stage: Stage; target: number } {
    const dueMs = calMs(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const nowMs = calMs(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.floor((dueMs - nowMs) / 86_400_000);
    if (days <= 0) return { stage: "overdue", target: 3 };
    if (days <= 1) return { stage: "due1", target: 2 };
    if (days <= 7) return { stage: "due7", target: 1 };
    return { stage: null, target: 0 };
}

function buildEmail(args: { stage: Exclude<Stage, null>; pkg: string; bookingNumber: string; amount: number; due: Date }) {
    const dueLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(args.due);
    const amt = formatPaiseRoundedUp(args.amount);
    const subject =
        args.stage === "overdue" ? `Balance overdue for ${args.pkg} (${args.bookingNumber})`
        : `Balance due ${args.stage === "due1" ? "tomorrow" : "soon"} for ${args.pkg}`;
    const lead =
        args.stage === "overdue" ? `Your balance payment of <b>${amt}</b> was due on ${dueLabel} and is now overdue.`
        : `This is a reminder that your balance payment of <b>${amt}</b> is due by <b>${dueLabel}</b>.`;
    const html = `
        <p>Hello,</p>
        <p>${lead}</p>
        <p>Booking: <b>${args.bookingNumber}</b> — ${args.pkg}</p>
        <p>Please complete your balance payment to keep your booking confirmed.</p>
        <p>— Dreams Yatri</p>`;
    return { subject, html };
}

export async function runBalanceReminders(opts?: { now?: Date; mailer?: Mailer }): Promise<ReminderSummary> {
    const now = opts?.now ?? new Date();
    const mailer = opts?.mailer ?? sendEmail;

    const items = await db.paymentInstallment.findMany({
        where: {
            type: "BALANCE",
            status: { in: ["PENDING", "OVERDUE"] },
            dueDate: { not: null },
            booking: { paymentStatus: "ADVANCE_PAID" },
        },
        select: {
            id: true, dueDate: true, amount_paise: true, reminderCount: true, status: true,
            booking: { select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } } } },
        },
    });

    let remindersSent = 0;
    let markedOverdue = 0;

    for (const it of items) {
        if (!it.dueDate) continue;
        const { stage, target } = stageFor(it.dueDate, now);
        if (!stage) continue;

        const becomingOverdue = stage === "overdue" && it.status !== "OVERDUE";
        const needsSend = it.reminderCount < target;
        if (!needsSend && !becomingOverdue) continue;

        if (needsSend) {
            const email = it.booking.user?.email;
            if (email) {
                const { subject, html } = buildEmail({
                    stage, pkg: it.booking.package?.title ?? "your package",
                    bookingNumber: it.booking.bookingNumber, amount: it.amount_paise, due: it.dueDate,
                });
                await mailer({ to: email, subject, html });
            }
            remindersSent++;
        }
        if (becomingOverdue) markedOverdue++;

        await db.paymentInstallment.update({
            where: { id: it.id },
            data: {
                reminderCount: needsSend ? target : it.reminderCount,
                reminderSentAt: needsSend ? now : undefined,
                status: stage === "overdue" ? "OVERDUE" : it.status,
            },
        });
    }

    return { scanned: items.length, remindersSent, markedOverdue };
}
