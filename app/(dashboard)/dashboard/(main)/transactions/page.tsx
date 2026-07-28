import type { Metadata } from "next";
import type { Prisma } from "@/app/generated/prisma";
import { Receipt, Wallet, Undo2 } from "lucide-react";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { TransactionsTableClient } from "./TransactionsTableClient";

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
                        // The login account often has no name (phone/OTP sign-up) —
                        // fall back to the lead traveller entered at checkout.
                        travellersList: { where: { isLead: true }, take: 1, select: { fullName: true } },
                    },
                },
            },
        }),
    ]);

    const capturedPaise = captured._sum.amount_paise ?? 0;
    const refundedPaise = Math.round(Number(refunded._sum.refundAmount ?? 0) * 100);

    // Decimal isn't serializable across the RSC → client boundary — flatten to a number.
    const rows = txns.map((t) => ({ ...t, refundAmount: t.refundAmount != null ? Number(t.refundAmount) : null }));

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Transactions</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Transactions"
                description="All payments across bookings — deposits, top-ups, balances and refunds"
                icon={Receipt}
            />

            <StatGrid cols={3}>
                <StatCard label="Transactions" value={total} icon={Receipt} />
                <StatCard label="Captured (in view)" value={formatPaise(capturedPaise)} icon={Wallet} />
                <StatCard label="Refunded (in view)" value={formatPaise(refundedPaise)} icon={Undo2} />
            </StatGrid>

            <TransactionsTableClient
                txns={rows}
                totalCount={total}
                limit={limit}
                currentPage={page}
                search={search}
                status={status}
                purpose={purpose}
                gateway={gateway}
                statusOptions={STATUSES}
                purposeOptions={PURPOSES}
                gatewayOptions={GATEWAYS}
            />
        </div>
    );
}
