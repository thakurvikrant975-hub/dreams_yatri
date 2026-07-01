import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../components/ConnectHeader";
import { Card } from "@/app/components/ui/Card";
import {
  CurrencyInrIcon,
  CalendarBlankIcon,
  TrendUpIcon,
  TrendDownIcon,
  ClockIcon,
  BankIcon,
  InfoIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/app/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────────────

type MonthlyRow = {
  monthLabel: string;    // "Jan 2025"
  monthKey: string;      // "2025-01"
  bookings: number;
  revenue: number;
};

async function getRevenueData(ownerId: string) {
  const ownerHotels = await db.hotels.findMany({
    where: { owner_id: ownerId },
    select: { id: true },
  });
  const hotelIds = ownerHotels.map((h) => h.id);

  const zero = { total: 0, thisMonth: 0, lastMonth: 0, upcoming: 0, monthly: [] as MonthlyRow[] };
  if (!hotelIds.length) return zero;

  const links = await db.bookingHotel.findMany({
    where: { hotelId: { in: hotelIds } },
    select: { bookingId: true },
    distinct: ["bookingId"],
  });
  if (!links.length) return zero;

  const bookingIds = links.map((l) => l.bookingId);

  const bookings = await db.booking.findMany({
    where: { id: { in: bookingIds } },
    select: { status: true, totalAmount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const now       = new Date();
  const msStart   = new Date(now.getFullYear(), now.getMonth(), 1);
  const lmsStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmsEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const earned = (b: typeof bookings[0]) =>
    !(["CANCELLED", "REJECTED", "PENDING_REVIEW"] as string[]).includes(b.status);

  const total      = bookings.filter(earned).reduce((s, b) => s + Number(b.totalAmount), 0);
  const thisMonth  = bookings.filter((b) => earned(b) && new Date(b.createdAt) >= msStart).reduce((s, b) => s + Number(b.totalAmount), 0);
  const lastMonth  = bookings.filter((b) => earned(b) && new Date(b.createdAt) >= lmsStart && new Date(b.createdAt) <= lmsEnd).reduce((s, b) => s + Number(b.totalAmount), 0);
  const upcoming   = bookings.filter((b) => (["UPCOMING", "CONFIRMED"] as string[]).includes(b.status)).reduce((s, b) => s + Number(b.totalAmount), 0);

  // Last 6 months breakdown
  const monthly: MonthlyRow[] = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dEnd  = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const slice = bookings.filter((b) => {
      const bc = new Date(b.createdAt);
      return bc >= d && bc <= dEnd;
    });
    monthly.push({
      monthLabel: label,
      monthKey:   key,
      bookings:   slice.length,
      revenue:    slice.filter(earned).reduce((s, b) => s + Number(b.totalAmount), 0),
    });
  }

  return { total, thisMonth, lastMonth, upcoming, monthly };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  if (n >= 1_00_000) {
    return `₹${(n / 1_00_000).toFixed(2)}L`;
  }
  if (n >= 1_000) {
    return `₹${(n / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function formatINRFull(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RevenuePage() {
  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const { total, thisMonth, lastMonth, upcoming, monthly } = await getRevenueData(ownerId);

  const momChange = lastMonth > 0
    ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
    : null;

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return (
    <>
      <ConnectHeader title="Revenue" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Earned",   value: formatINR(total),      icon: CurrencyInrIcon,   color: "text-primary-600",  bg: "bg-primary-50"  },
              { label: "This Month",     value: formatINR(thisMonth),   icon: CalendarBlankIcon,  color: "text-blue-600",    bg: "bg-blue-50"    },
              { label: "Last Month",     value: formatINR(lastMonth),   icon: ClockIcon,          color: "text-neutral-500", bg: "bg-neutral-100" },
              { label: "Confirmed (₹)",  value: formatINR(upcoming),    icon: CheckCircleIcon,    color: "text-emerald-600", bg: "bg-emerald-50"  },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} variant="elevated" radius="md">
                <div className="p-4 flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
                    <Icon size={17} weight="fill" className={color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-neutral-900 leading-none mb-0.5 truncate">{value}</p>
                    <p className="text-xs text-neutral-500">{label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* MoM indicator */}
          {momChange !== null && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium",
              momChange >= 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800",
            )}>
              {momChange >= 0
                ? <TrendUpIcon size={16} weight="fill" className="text-emerald-500 shrink-0" />
                : <TrendDownIcon size={16} weight="fill" className="text-red-500 shrink-0" />}
              Revenue is <strong>{Math.abs(momChange)}%</strong> {momChange >= 0 ? "higher" : "lower"} than last month
              <span className="ml-auto text-xs font-normal opacity-70">
                {formatINRFull(lastMonth)} → {formatINRFull(thisMonth)}
              </span>
            </div>
          )}

          {/* Two-col: bar chart + table */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Bar chart */}
            <Card variant="elevated" radius="md" className="lg:col-span-3 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100">
                <h3 className="text-sm font-semibold text-neutral-700">Monthly Revenue</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Last 6 months</p>
              </div>
              <div className="p-5">
                {total === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center">
                    <CurrencyInrIcon size={28} weight="duotone" className="text-neutral-300 mb-2" />
                    <p className="text-sm text-neutral-400">No revenue data yet</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 h-44">
                    {monthly.map((m) => {
                      const heightPct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
                      const isCurrent = m.monthKey === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                      return (
                        <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div className="w-full flex flex-col items-center gap-1">
                            {m.revenue > 0 && (
                              <span className="text-[9px] font-semibold text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {formatINR(m.revenue)}
                              </span>
                            )}
                            <div className="w-full rounded-t-md overflow-hidden" style={{ height: "140px" }}>
                              <div
                                className={cn(
                                  "w-full rounded-t-md transition-all duration-500",
                                  isCurrent ? "bg-primary-500" : "bg-primary-200 group-hover:bg-primary-400",
                                )}
                                style={{
                                  height: `${Math.max(heightPct, m.revenue > 0 ? 4 : 0)}%`,
                                  marginTop: "auto",
                                  position: "relative",
                                  bottom: 0,
                                  alignSelf: "flex-end",
                                }}
                              />
                            </div>
                          </div>
                          <span className={cn(
                            "text-[10px] font-medium whitespace-nowrap",
                            isCurrent ? "text-primary-600 font-semibold" : "text-neutral-400",
                          )}>
                            {m.monthLabel.split(" ")[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Monthly table */}
            <Card variant="elevated" radius="md" className="lg:col-span-2 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100">
                <h3 className="text-sm font-semibold text-neutral-700">Breakdown</h3>
              </div>
              <div className="divide-y divide-neutral-50">
                {[...monthly].reverse().map((m) => {
                  const isCurrent = m.monthKey === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                  return (
                    <div key={m.monthKey} className={cn("px-5 py-3 flex items-center justify-between gap-3", isCurrent && "bg-primary-50/40")}>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", isCurrent ? "text-primary-700" : "text-neutral-700")}>
                          {m.monthLabel}
                          {isCurrent && <span className="ml-1.5 text-[9px] font-bold bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full">Current</span>}
                        </p>
                        <p className="text-xs text-neutral-400">{m.bookings} booking{m.bookings !== 1 ? "s" : ""}</p>
                      </div>
                      <p className={cn("text-sm font-bold shrink-0", m.revenue > 0 ? "text-neutral-900" : "text-neutral-300")}>
                        {m.revenue > 0 ? formatINRFull(m.revenue) : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Payout info */}
          <Card variant="elevated" radius="md">
            <div className="p-5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <BankIcon size={17} weight="fill" className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">Payout Schedule</p>
                <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                  Payouts are processed within <strong>7 business days</strong> after a guest&apos;s check-out date.
                  Ensure your bank details in{" "}
                  <span className="text-primary-600 font-medium">Finance &amp; Legal</span> are up to date.
                </p>
              </div>
              <div className="ml-auto shrink-0 flex items-center gap-1 text-xs text-neutral-400">
                <InfoIcon size={13} className="text-neutral-300" />
                INR only
              </div>
            </div>
          </Card>

        </div>
      </div>
    </>
  );
}
