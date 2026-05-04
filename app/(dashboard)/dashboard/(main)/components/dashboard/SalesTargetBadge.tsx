// app/(dashboard)/components/dashboard/SalesTargetBadge.tsx
import { getSalesTargetData } from "../../actions/sales-target-actions";
import { Suspense } from "react";

interface SalesTargetBadgeProps {
  memberId: string;
}

function getBarColor(pct: number): string {
  if (pct >= 100) return "#22c55e"; // green-500
  if (pct >= 70)  return "#3b82f6"; // blue-500
  if (pct >= 40)  return "#f59e0b"; // amber-500
  return "#ef4444";                  // red-500
}

function getEmoji(pct: number): string {
  if (pct >= 100) return "🏆";
  if (pct >= 70)  return "🔥";
  if (pct >= 40)  return "💪";
  return "🐢";
}

function formatRevenue(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

async function SalesTargetContent({ memberId }: { memberId: string }) {
  const data = await getSalesTargetData(memberId);
  const pct  = Math.min(100, Math.round((data.confirmedThisMonth / Math.max(1, data.monthlyTarget)) * 100));
  const barColor = getBarColor(pct);
  const emoji    = getEmoji(pct);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-border bg-muted/40">
      {/* Emoji badge */}
      <span className="text-2xl leading-none">{emoji}</span>

      {/* Stats + bar */}
      <div className="flex flex-col gap-1 min-w-0">
        {/* Numbers row */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">
            {data.confirmedThisMonth}
          </span>
          <span className="text-xs text-muted-foreground leading-none">
            / {data.monthlyTarget} bookings
          </span>
          {data.totalRevenue > 0 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 leading-none">
                {formatRevenue(data.totalRevenue)}
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div
          style={{ width: "120px", height: "5px", borderRadius: "9999px", backgroundColor: "var(--muted)" }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: "9999px",
              backgroundColor: barColor,
              transition: "width 600ms ease",
            }}
          />
        </div>
      </div>

      {/* Percentage pill */}
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
        style={{
          backgroundColor: `${barColor}20`,
          color: barColor,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function SalesTargetSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-border bg-muted/40 animate-pulse">
      <div className="h-5 w-5 rounded-full bg-muted" />
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-1.5 w-28 rounded-full bg-muted" />
      </div>
      <div className="h-4 w-8 rounded-full bg-muted" />
    </div>
  );
}

export function SalesTargetBadge({ memberId }: SalesTargetBadgeProps) {
  return (
    <Suspense fallback={<SalesTargetSkeleton />}>
      <SalesTargetContent memberId={memberId} />
    </Suspense>
  );
}