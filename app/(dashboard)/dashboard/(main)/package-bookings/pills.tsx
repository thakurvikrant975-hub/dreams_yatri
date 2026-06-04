// Presentational status pills shared by the list + detail views.

const TONE: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
    gray: "bg-neutral-100 text-neutral-600",
};

function Pill({ tone, children }: { tone: keyof typeof TONE | string; children: React.ReactNode }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone] ?? TONE.gray}`}>
            {children}
        </span>
    );
}

const PAYMENT_TONE: Record<string, string> = {
    PENDING: "amber",
    ADVANCE_PAID: "blue",
    FULLY_PAID: "green",
    REFUNDED: "purple",
    PARTIALLY_REFUNDED: "purple",
    FAILED: "red",
    TESTING: "gray",
};

const PAYMENT_LABEL: Record<string, string> = {
    PENDING: "Payment pending",
    ADVANCE_PAID: "Deposit paid",
    FULLY_PAID: "Paid in full",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partly refunded",
    FAILED: "Failed",
    TESTING: "Testing",
};

const STATUS_TONE: Record<string, string> = {
    UPCOMING: "blue",
    ONGOING: "blue",
    COMPLETED: "green",
    CONFIRMED: "green",
    HOTEL_CONFIRMED: "green",
    CAB_CONFIRMED: "green",
    CANCELLED: "red",
    REJECTED: "red",
    PENDING_REVIEW: "amber",
    HOTEL_VERIFICATION: "amber",
    CAB_VERIFICATION: "amber",
    OPS_REVIEW: "amber",
    MODIFICATION_REQUESTED: "amber",
};

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function PaymentPill({ status }: { status: string }) {
    return <Pill tone={PAYMENT_TONE[status] ?? "gray"}>{PAYMENT_LABEL[status] ?? titleCase(status)}</Pill>;
}

export function StatusPill({ status }: { status: string }) {
    return <Pill tone={STATUS_TONE[status] ?? "gray"}>{titleCase(status)}</Pill>;
}
