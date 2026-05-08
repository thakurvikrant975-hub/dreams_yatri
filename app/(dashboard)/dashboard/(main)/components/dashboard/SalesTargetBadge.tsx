// app/(dashboard)/components/dashboard/SalesTargetBadge.tsx
import { getSalesTargetData } from "../../actions/sales-target-actions";
import { Suspense } from "react";
import Image from "next/image";
import { BadgeShell } from "./Salestargetbadgeshell";

interface SalesTargetBadgeProps {
  memberId: string;
}

type Tier = {
  color: string;
  bg: string;
  border: string;
  orbBg: string;
  image: string;
  alt: string;
  label: string;
};

function getTier(pct: number): Tier {
  if (pct >= 100) return {
    color:  "#16a34a",
    bg:     "rgba(22,163,74,0.09)",
    border: "rgba(22,163,74,0.28)",
    orbBg:  "rgba(22,163,74,0.14)",
    image:  "/dashboard/done.jpg",
    alt:    "Champion",
    label:  "Champion",
  };
  if (pct >= 70) return {
    color:  "#2563eb",
    bg:     "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.22)",
    orbBg:  "rgba(37,99,235,0.12)",
    image:  "/dashboard/good.jpg",
    alt:    "On track",
    label:  "On Track",
  };
  if (pct >= 40) return {
    color:  "#d97706",
    bg:     "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.22)",
    orbBg:  "rgba(217,119,6,0.12)",
    image:  "/dashboard/medium.jpg",
    alt:    "Keep going",
    label:  "Keep Going",
  };
  return {
    color:  "#dc2626",
    bg:     "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.2)",
    orbBg:  "rgba(220,38,38,0.12)",
    image:  "/dashboard/low.jpg",
    alt:    "Needs push",
    label:  "Needs Push",
  };
}

function formatRevenue(amount: number): string {
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)   return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount}`;
}

/** Tiny sparkle dots rendered only when the target is fully hit. */
function Sparks({ color }: { color: string }) {
  const positions = [
    { top: "10%",  left: "6%",  delay: "0s" },
    { top: "15%",  left: "72%", delay: "0.28s" },
    { top: "62%",  left: "82%", delay: "0.55s" },
    { top: "68%",  left: "12%", delay: "0.82s" },
    { top: "38%",  left: "44%", delay: "1.1s" },
  ];
  return (
    <>
      {positions.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position:        "absolute",
            width:           5,
            height:          5,
            borderRadius:    "50%",
            backgroundColor: color,
            top:             p.top,
            left:            p.left,
            animation:       `stb-sparkle 1.6s ${p.delay} ease-in-out infinite`,
            pointerEvents:   "none",
          }}
        />
      ))}
    </>
  );
}

async function SalesTargetContent({ memberId }: { memberId: string }) {
  const data = await getSalesTargetData(memberId);
  // const pct  = Math.min(100, Math.round(
  //   (data.confirmedThisMonth / Math.max(1, data.monthlyTarget)) * 100
  // ));
  const pct =751;
  const tier = getTier(pct);
  const isChampion = pct >= 100;
 
  return (
    <>
      {/* Keyframe styles – injected once per render */}
      <style>{`
        @keyframes stb-fill {
          from { width: 0% }
          to   { width: ${pct}% }
        }
        @keyframes stb-bobble {
          0%, 100% { transform: translateY(0)    }
          50%       { transform: translateY(-3px) }
        }
        @keyframes stb-pop {
          0%   { transform: scale(0.5); opacity: 0 }
          60%  { transform: scale(1.18)             }
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
      `}</style>

      <BadgeShell
        ariaLabel={`Sales target: ${pct}% — ${data.confirmedThisMonth} of ${data.monthlyTarget} bookings`}
        style={{
          display:         "inline-flex",
          alignItems:      "center",
          gap:             10,
          padding:         "7px 13px 7px 9px",
          borderRadius:    9999,
          border:          `1px solid ${tier.border}`,
          backgroundColor: tier.bg,
          position:        "relative",
          overflow:        "hidden",
          userSelect:      "none",
          transition:      "transform 0.2s ease",
        }}
      >
        {/* Celebration sparkles for champion tier */}
        {isChampion && <Sparks color={tier.color} />}

        {/* Tier image orb */}
        <span
          aria-hidden="true"
          style={{
            width:           36,
            height:          36,
            borderRadius:    "50%",
            backgroundColor: tier.orbBg,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            flexShrink:      0,
            overflow:        "hidden",
            animation:       "stb-bobble 2.6s ease-in-out infinite",
          }}
        >
          <Image
            src={tier.image}
            alt={tier.alt}
            width={36}
            height={36}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </span>

        {/* Stats column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {/* Numbers row */}
          <div
            style={{
              display:     "flex",
              alignItems:  "baseline",
              gap:         4,
              animation:   "stb-in 0.4s 0.1s both",
            }}
          >
            {/* Confirmed count – colour-coded */}
            <span
              style={{
                fontSize:            15,
                fontWeight:          700,
                fontVariantNumeric:  "tabular-nums",
                letterSpacing:       "-0.3px",
                color:               tier.color,
              }}
            >
              {data.confirmedThisMonth}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground, #888)" }}>/</span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground, #888)" }}>
              {data.monthlyTarget} bookings
            </span>

            {/* Revenue dot + amount */}
            {data.totalRevenue > 0 && (
              <>
                <span style={{ fontSize: 12, color: "var(--muted-foreground, #aaa)" }}>·</span>
                <span
                  style={{
                    fontSize:    12,
                    fontWeight:  700,
                    color:       tier.color,
                    letterSpacing: "-0.2px",
                  }}
                >
                  {formatRevenue(data.totalRevenue)}
                </span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div
            aria-hidden="true"
            style={{
              width:           130,
              height:          6,
              borderRadius:    9999,
              backgroundColor: "var(--muted, #e5e7eb)",
              overflow:        "hidden",
              position:        "relative",
            }}
          >
            <div
              style={{
                height:          "100%",
                width:           `${pct}%`,
                borderRadius:    9999,
                backgroundColor: tier.color,
                position:        "relative",
                overflow:        "hidden",
                animation:       "stb-fill 0.85s cubic-bezier(0.34,1.56,0.64,1) 0.2s both",
              }}
            >
              {/* Shimmer sweep */}
              <span
                style={{
                  position:   "absolute",
                  inset:       0,
                  background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.45) 50%,transparent 100%)",
                  width:       "40%",
                  animation:  "stb-shimmer 2s 1s infinite",
                }}
              />
            </div>
          </div>
        </div>

        {/* Percentage pill */}
        <span
          aria-hidden="true"
          style={{
            fontSize:        11,
            fontWeight:      700,
            letterSpacing:   "0.3px",
            padding:         "3px 8px",
            borderRadius:    9999,
            flexShrink:      0,
            backgroundColor: tier.bg,
            border:          `1px solid ${tier.border}`,
            color:           tier.color,
            animation:       "stb-pop 0.5s 0.4s both",
          }}
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
      style={{
        display:         "inline-flex",
        alignItems:      "center",
        gap:             10,
        padding:         "7px 13px 7px 9px",
        borderRadius:    9999,
        border:          "1px solid var(--border, #e5e7eb)",
        backgroundColor: "var(--muted, #f3f4f6)",
      }}
    >
      <style>{`
        @keyframes stb-pulse {
          0%,100% { opacity: 1 }
          50%      { opacity: 0.45 }
        }
        .stb-skel { background: var(--muted-foreground, #d1d5db); border-radius: 9999px; animation: stb-pulse 1.4s ease-in-out infinite; }
      `}</style>
      {/* Orb placeholder */}
      <div className="stb-skel" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
      {/* Text + bar placeholders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="stb-skel" style={{ width: 120, height: 12 }} />
        <div className="stb-skel" style={{ width: 130, height: 6 }} />
      </div>
      {/* Pill placeholder */}
      <div className="stb-skel" style={{ width: 34, height: 20 }} />
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