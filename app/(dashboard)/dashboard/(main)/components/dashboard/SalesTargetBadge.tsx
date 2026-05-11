// app/(dashboard)/components/dashboard/SalesTargetBadge.tsx
import { getSalesDashboardData } from "../../actions/sales-dashboard-actions.ts";
import { Suspense } from "react";
import Image from "next/image";
import { BadgeShell } from "./Salestargetbadgeshell";

interface SalesTargetBadgeProps {
  memberId: string;
}

type Tier = {
  // Tailwind class bundles
  badgeBorder: string;
  badgeBg:     string;
  textColor:   string;
  // Inline style values (CSS variables resolved at runtime)
  color:       string; // progress bar fill, pill text, sparks
  pillBg:      string; // pill background
  pillBorder:  string; // pill border
  orbBg:       string; // orb tint
  // Content
  image: string;
  alt:   string;
  label: string;
};

// ─── Map each tier to dashboard theme tokens ──────────────────────────────────
//
// Tailwind classes  → direct dashboard-* utility names (no var() in class strings)
// Inline style vals → var(--color-dashboard-*) so the browser resolves the OKLCH
//                     value at runtime; this is correct — var() belongs in styles,
//                     not in Tailwind class attribute strings.
//
function getTier(pct: number): Tier {
  if (pct >= 100) return {
    badgeBorder: "border-dashboard-success/30",
    badgeBg:     "bg-dashboard-success/10",
    textColor:   "text-dashboard-success",
    color:       "var(--color-dashboard-success)",
    pillBg:      "color-mix(in oklch, var(--color-dashboard-success) 12%, transparent)",
    pillBorder:  "color-mix(in oklch, var(--color-dashboard-success) 32%, transparent)",
    orbBg:       "color-mix(in oklch, var(--color-dashboard-success) 16%, transparent)",
    image: "/dashboard/achieved-target.jpg",
    alt:   "Champion",
    label: "Champion",
  };
  if (pct >= 70) return {
    badgeBorder: "border-dashboard-secondary/25",
    badgeBg:     "bg-dashboard-secondary/[.08]",
    textColor:   "text-dashboard-secondary",
    color:       "var(--color-dashboard-secondary)",
    pillBg:      "color-mix(in oklch, var(--color-dashboard-secondary) 10%, transparent)",
    pillBorder:  "color-mix(in oklch, var(--color-dashboard-secondary) 25%, transparent)",
    orbBg:       "color-mix(in oklch, var(--color-dashboard-secondary) 14%, transparent)",
    image: "/dashboard/good-target.jpg",
    alt:   "On track",
    label: "On Track",
  };
  if (pct >= 40) return {
    badgeBorder: "border-dashboard-warning/25",
    badgeBg:     "bg-dashboard-warning/[.08]",
    textColor:   "text-dashboard-warning-content",
    color:       "var(--color-dashboard-warning)",
    pillBg:      "color-mix(in oklch, var(--color-dashboard-warning) 10%, transparent)",
    pillBorder:  "color-mix(in oklch, var(--color-dashboard-warning) 25%, transparent)",
    orbBg:       "color-mix(in oklch, var(--color-dashboard-warning) 14%, transparent)",
    image: "/dashboard/medium-target.jpg",
    alt:   "Keep going",
    label: "Keep Going",
  };
  return {
    badgeBorder: "border-dashboard-error/25",
    badgeBg:     "bg-dashboard-error/[.08]",
    textColor:   "text-dashboard-error",
    color:       "var(--color-dashboard-error)",
    pillBg:      "color-mix(in oklch, var(--color-dashboard-error) 10%, transparent)",
    pillBorder:  "color-mix(in oklch, var(--color-dashboard-error) 22%, transparent)",
    orbBg:       "color-mix(in oklch, var(--color-dashboard-error) 14%, transparent)",
    image: "/dashboard/low-target.jpg",
    alt:   "Needs push",
    label: "Needs Push",
  };
}

function formatRevenue(amount: number): string {
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)   return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount}`;
}

function Sparks({ color }: { color: string }) {
  const positions = [
    { top: "10%", left: "6%",  delay: "0s"    },
    { top: "15%", left: "72%", delay: "0.28s" },
    { top: "62%", left: "82%", delay: "0.55s" },
    { top: "68%", left: "12%", delay: "0.82s" },
    { top: "38%", left: "44%", delay: "1.1s"  },
  ];
  return (
    <>
      {positions.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute size-[5px] rounded-full pointer-events-none"
          style={{
            backgroundColor: color,
            top: p.top, left: p.left,
            animation: `stb-sparkle 1.6s ${p.delay} ease-in-out infinite`,
          }}
        />
      ))}
    </>
  );
}

async function SalesTargetContent({ memberId }: { memberId: string }) {
  const data = await getSalesDashboardData(memberId);

  const pct = Math.min(100, Math.round(
    (data.confirmedThisMonth / Math.max(1, data.monthlyTarget)) * 100
  ));
  const totalRevenue = 0;

  const tier       = getTier(pct);
  const isChampion = pct >= 100;

  return (
    <>
      <style>{`
        @keyframes stb-fill {
          from { width: 0% } to { width: ${pct}% }
        }
        @keyframes stb-bobble {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-3px) }
        }
        @keyframes stb-pop {
          0%   { transform: scale(0.5); opacity: 0 }
          60%  { transform: scale(1.18) }
          100% { transform: scale(1);   opacity: 1 }
        }
        @keyframes stb-shimmer {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(220%)  }
        }
        @keyframes stb-sparkle {
          0%   { opacity: 0; transform: scale(0) rotate(0deg)   }
          50%  { opacity: 1; transform: scale(1) rotate(180deg) }
          100% { opacity: 0; transform: scale(0) rotate(360deg) }
        }
        @keyframes stb-in {
          from { opacity: 0; transform: translateY(3px) }
          to   { opacity: 1; transform: translateY(0)   }
        }
        .stb-fill    { animation: stb-fill    0.85s cubic-bezier(0.34,1.56,0.64,1) 0.2s both }
        .stb-bobble  { animation: stb-bobble  2.6s ease-in-out infinite }
        .stb-pop     { animation: stb-pop     0.5s 0.4s both }
        .stb-shimmer { animation: stb-shimmer 2s   1s   infinite }
        .stb-in      { animation: stb-in      0.4s 0.1s both }
      `}</style>

      <BadgeShell
        ariaLabel={`Sales target: ${pct}% — ${data.confirmedThisMonth} of ${data.monthlyTarget} bookings`}
        className={`inline-flex items-center gap-2.5 pl-2.5 pr-3.5 py-[7px] rounded-full border relative overflow-hidden select-none transition-transform duration-200 ease-out ${tier.badgeBorder} ${tier.badgeBg}`}
      >
        {/* Champion sparkles */}
        {isChampion && <Sparks color={tier.color} />}

        {/* Tier image orb */}
        <span
          aria-hidden="true"
          className="stb-bobble shrink-0 flex items-center justify-center size-9 rounded-full overflow-hidden"
          style={{ backgroundColor: tier.orbBg }}
        >
          <Image
            src={tier.image}
            alt={tier.alt}
            width={36}
            height={36}
            className="object-cover w-full h-full"
          />
        </span>

        {/* Stats column */}
        <div className="flex flex-col gap-1">

          {/* Numbers row */}
          <div className="stb-in flex items-baseline gap-1">
            <span className={`text-[15px] font-bold tabular-nums tracking-tight ${tier.textColor}`}>
              {data.confirmedThisMonth}
            </span>

            <span className="text-xs text-dashboard-base-content/50">/</span>

            <span className="text-xs text-dashboard-base-content/50">
              {data.monthlyTarget} bookings
            </span>

            {totalRevenue > 0 && (
              <>
                <span className="text-xs text-dashboard-base-content/30">·</span>
                <span className={`text-xs font-bold tracking-tight ${tier.textColor}`}>
                  {formatRevenue(totalRevenue)}
                </span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div
            aria-hidden="true"
            className="w-[130px] h-1.5 rounded-full bg-dashboard-base-300 overflow-hidden relative"
          >
            <div
              className="stb-fill h-full rounded-full relative overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: tier.color }}
            >
              <span
                className="stb-shimmer absolute inset-0 w-[40%]"
                style={{ background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.45) 50%,transparent 100%)" }}
              />
            </div>
          </div>
        </div>

        {/* Percentage pill */}
        <span
          aria-hidden="true"
          className="stb-pop shrink-0 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: tier.pillBg, borderColor: tier.pillBorder, color: tier.color }}
        >
          {pct}%
        </span>
      </BadgeShell>
    </>
  );
}

function SalesTargetSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading sales target…"
      className="inline-flex items-center gap-2.5 pl-2.5 pr-3.5 py-[7px] rounded-full border border-dashboard-base-300 bg-dashboard-base-200"
    >
      <style>{`
        @keyframes stb-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .stb-skel { background: var(--color-dashboard-base-300); border-radius:9999px; animation:stb-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="stb-skel shrink-0 size-9 rounded-full" />
      <div className="flex flex-col gap-1.5">
        <div className="stb-skel w-[120px] h-3 rounded-full" />
        <div className="stb-skel w-[130px] h-1.5 rounded-full" />
      </div>
      <div className="stb-skel w-[34px] h-5 rounded-full" />
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