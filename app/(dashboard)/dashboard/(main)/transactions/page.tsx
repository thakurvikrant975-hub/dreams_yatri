import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill } from "../package-bookings/pills";
import TransactionsFilters from "./TransactionsFilters";

export const metadata: Metadata = {
    title: "Transactions - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const STATUSES = ["PENDING", "ADVANCE_PAID", "FULLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED", "TESTING"];
const PURPOSES = [
    { value: "INITIAL", label: "Initial" },
    { value: "TOPUP", label: "Top-up" },
    { value: "BALANCE", label: "Balance" },
];
const GATEWAYS = ["RAZORPAY", "PAYU", "OFFLINE", "PHONEPE"];

const PURPOSE_LABEL: Record<string, string> = { INITIAL: "Initial", TOPUP: "Top-up", BALANCE: "Balance" };
const PURPOSE_TONE: Record<string, string> = { INITIAL: "bg-blue-100 text-blue-700", TOPUP: "bg-purple-100 text-purple-700", BALANCE: "bg-amber-100 text-amber-700" };

function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const sp = await searchParams;
    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const status = STATUSES.includes(sp.status ?? "") ? sp.status : "";
    const purpose = PURPOSES.some((p) => p.value === sp.purpose) ? sp.purpose : "";
    const gateway = GATEWAYS.includes(sp.gateway ?? "") ? sp.gateway : "";

    const where: Prisma.PaymentWhereInput = {
        ...(status ? { status: status as Prisma.PaymentWhereInput["status"] } : {}),
        ...(purpose ? { purpose: purpose as Prisma.PaymentWhereInput["purpose"] } : {}),
        ...(gateway ? { gateway: gateway as Prisma.PaymentWhereInput["gateway"] } : {}),
        ...(search
            ? {
                  OR: [
                      { gatewayPaymentId: { contains: search, mode: "insensitive" } },
                      { gatewayOrderId: { contains: search, mode: "insensitive" } },
                      { booking: { bookingNumber: { contains: search, mode: "insensitive" } } },
                      { booking: { contactEmail: { contains: search, mode: "insensitive" } } },
                      { booking: { user: { name: { contains: search, mode: "insensitive" } } } },
                  ],
              }
            : {}),
    };

    const [total, captured, refunded, txns] = await Promise.all([
        db.payment.count({ where }),
        db.payment.aggregate({ where: { ...where, status: { in: ["ADVANCE_PAID", "FULLY_PAID", "PARTIALLY_REFUNDED"] } }, _sum: { amount_paise: true } }),
        db.payment.aggregate({ where: { ...where, refundedAt: { not: null } }, _sum: { refundAmount: true } }),
        db.payment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, amount_paise: true, gateway: true, method: true, status: true, purpose: true,
                gatewayPaymentId: true, gatewayOrderId: true, refundAmount: true, refundedAt: true,
                failureReason: true, createdAt: true, paidAt: true,
                booking: {
                    select: {
                        id: true, bookingNumber: true, contactEmail: true,
                        user: { select: { name: true } },
                        package: { select: { title: true } },
                    },
                },
            },
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    const capturedPaise = captured._sum.amount_paise ?? 0;
    const refundedPaise = Math.round(Number(refunded._sum.refundAmount ?? 0) * 100);

    const qs = (next: Record<string, string | number>) => {
        const p = new URLSearchParams();
        if (search) p.set("search", search);
        if (status) p.set("status", status);
        if (purpose) p.set("purpose", purpose);
        if (gateway) p.set("gateway", gateway);
        for (const [k, v] of Object.entries(next)) { if (v === "" || v == null) p.delete(k); else p.set(k, String(v)); }
        const s = p.toString();
        return s ? `?${s}` : "";
    };

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="text-xl font-semibold text-dashboard-base-content">Transactions</h1>
                <p className="text-sm text-dashboard-neutral mt-0.5">All payments across bookings — deposits, top-ups, balances and refunds.</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
                <Stat label="Transactions" value={String(total)} />
                <Stat label="Captured (in view)" value={formatPaise(capturedPaise)} tone="text-green-600" />
                <Stat label="Refunded (in view)" value={formatPaise(refundedPaise)} tone="text-purple-600" />
            </div>

            <TransactionsFilters
                search={search} status={status ?? ""} purpose={purpose ?? ""} gateway={gateway ?? ""}
                statusOptions={STATUSES} purposeOptions={PURPOSES} gatewayOptions={GATEWAYS}
            />

            <div className="overflow-x-auto rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-dashboard-base-300 text-left text-xs uppercase tracking-wide text-dashboard-neutral">
                            <th className="px-4 py-3 font-medium">When</th>
                            <th className="px-4 py-3 font-medium">Booking</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                            <th className="px-4 py-3 font-medium">Gateway</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Gateway ref</th>
                        </tr>
                    </thead>
                    <tbody>
                        {txns.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-dashboard-neutral">No transactions match these filters.</td></tr>
                        ) : (
                            txns.map((t) => (
                                <tr key={t.id} className="border-b border-dashboard-base-300/60 last:border-0 hover:bg-dashboard-base-200/50 transition-colors align-top">
                                    <td className="px-4 py-3 whitespace-nowrap text-dashboard-base-content">{fmtDateTime(t.paidAt ?? t.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        <Link href={`/dashboard/package-bookings/${t.booking.id}`} className="font-medium text-dashboard-primary hover:underline">{t.booking.bookingNumber}</Link>
                                        <div className="text-xs text-dashboard-neutral truncate max-w-44">{t.booking.package?.title ?? ""}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-dashboard-base-content">{t.booking.user?.name ?? "—"}</div>
                                        <div className="text-xs text-dashboard-neutral">{t.booking.contactEmail ?? ""}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PURPOSE_TONE[t.purpose] ?? "bg-neutral-100 text-neutral-600"}`}>{PURPOSE_LABEL[t.purpose] ?? titleCase(t.purpose)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-dashboard-base-content whitespace-nowrap">
                                        {formatPaise(t.amount_paise)}
                                        {t.refundedAt && t.refundAmount != null && (
                                            <div className="text-xs font-normal text-purple-600">−{formatPaise(Math.round(Number(t.refundAmount) * 100))} refunded</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-dashboard-base-content">{titleCase(t.gateway)}{t.method ? <div className="text-xs text-dashboard-neutral">{titleCase(t.method)}</div> : null}</td>
                                    <td className="px-4 py-3"><PaymentPill status={t.status} /></td>
                                    <td className="px-4 py-3 text-xs text-dashboard-neutral break-all max-w-44">
                                        {t.gatewayPaymentId ?? t.gatewayOrderId ?? "—"}
                                        {t.failureReason && <div className="text-red-600">{t.failureReason}</div>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-dashboard-neutral">Showing {from}–{to} of {total}</span>
                <div className="flex items-center gap-2">
                    <PageLink disabled={page <= 1} href={qs({ page: page - 1 })} label="Previous" />
                    <span className="text-dashboard-neutral px-1">Page {page} of {totalPages}</span>
                    <PageLink disabled={page >= totalPages} href={qs({ page: page + 1 })} label="Next" />
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-dashboard-neutral">{label}</div>
            <div className={`mt-1 text-lg font-semibold ${tone ?? "text-dashboard-base-content"}`}>{value}</div>
        </div>
    );
}

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
    if (disabled) return <span className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-dashboard-neutral/50 cursor-not-allowed">{label}</span>;
    return <Link href={`/dashboard/transactions${href}`} className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-dashboard-base-content hover:bg-dashboard-primary/10 hover:text-dashboard-primary transition-colors">{label}</Link>;
}
