// app/dashboard/components/shared/GreetingBanner.tsx
"use client";

import { useEffect, useState } from "react";

interface GreetingBannerProps {
  name:        string;
  role?:       string | null;
  department?: string | null;
}

type Accent = {
  strip:      string;
  label:      string;
  roleBg:     string;
  roleBorder: string;
  roleText:   string;
  deptBg:     string;
  deptBorder: string;
  deptText:   string;
};

type Greeting = {
  text:   string;
  emoji:  string;
  sub:    string;
  accent: Accent;
};

const AMBER: Accent = {
  strip:      "#f59e0b",
  label:      "#b45309",
  roleBg:     "rgba(245,158,11,0.10)",
  roleBorder: "rgba(245,158,11,0.30)",
  roleText:   "#92400e",
  deptBg:     "rgba(245,158,11,0.06)",
  deptBorder: "rgba(245,158,11,0.20)",
  deptText:   "#a16207",
};

const BLUE: Accent = {
  strip:      "#3b82f6",
  label:      "#1d4ed8",
  roleBg:     "rgba(59,130,246,0.10)",
  roleBorder: "rgba(59,130,246,0.30)",
  roleText:   "#1e40af",
  deptBg:     "rgba(59,130,246,0.06)",
  deptBorder: "rgba(59,130,246,0.20)",
  deptText:   "#1d4ed8",
};

const VIOLET: Accent = {
  strip:      "#8b5cf6",
  label:      "#6d28d9",
  roleBg:     "rgba(139,92,246,0.10)",
  roleBorder: "rgba(139,92,246,0.30)",
  roleText:   "#5b21b6",
  deptBg:     "rgba(139,92,246,0.06)",
  deptBorder: "rgba(139,92,246,0.20)",
  deptText:   "#6d28d9",
};

const SLATE: Accent = {
  strip:      "#64748b",
  label:      "#334155",
  roleBg:     "rgba(100,116,139,0.10)",
  roleBorder: "rgba(100,116,139,0.30)",
  roleText:   "#1e293b",
  deptBg:     "rgba(100,116,139,0.06)",
  deptBorder: "rgba(100,116,139,0.20)",
  deptText:   "#334155",
};

function getGreeting(hour: number): Greeting {
  if (hour < 10)  return { text: "Namaste",       emoji: "🙏", sub: "Office khula ya tumne hi start kiya?",      accent: AMBER  };
  if (hour < 11)  return { text: "Namaste",        emoji: "🙏", sub: "Uncle bringing you chai?",                 accent: AMBER  };
  if (hour < 12)  return { text: "Good morning",   emoji: "☕", sub: "Chai in hand?",                             accent: AMBER  };
  if (hour < 17)  return { text: "Good afternoon", emoji: "☀️", sub: "Peak hours. Peak energy. Let's go.",        accent: BLUE   };
  if (hour < 21)  return { text: "Good evening",   emoji: "🥱", sub: "Almost done for the day. Wrap up strong.",  accent: VIOLET };
  return           { text: "Still here?",           emoji: "🌙", sub: "Respect the grind. Don't forget to sleep.", accent: SLATE  };
}

function useLiveClock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-IN", {
        hour:   "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function GreetingBanner({ name, role, department }: GreetingBannerProps) {
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const time = useLiveClock();

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  const firstName = name.split(" ")[0];

  // Skeleton — same height as final render, no layout shift
  if (!greeting) {
    return (
      <div className="w-full flex items-center justify-between py-3">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
          <div className="h-3 w-52 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const { accent } = greeting;

  return (
    <>
      <style>{`
        @keyframes gb-up {
          from { opacity: 0; transform: translateY(6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes gb-pop {
          from { opacity: 0; transform: scale(0.85) }
          to   { opacity: 1; transform: scale(1) }
        }
        .gb-up   { animation: gb-up  0.45s cubic-bezier(0.22,1,0.36,1) both }
        .gb-pop  { animation: gb-pop 0.4s  cubic-bezier(0.34,1.56,0.64,1) both }
        .gb-pop2 { animation: gb-pop 0.4s  0.07s cubic-bezier(0.34,1.56,0.64,1) both }
      `}</style>

      {/*
        Full-width flat layout — no card border/background.
        Left-right layout is always maintained with `justify-between`.
        `min-w-0` on the left prevents it from ever pushing the right side off.
        `shrink-0` on the right prevents it from collapsing.
      */}
      <div className="w-full flex items-end justify-between gap-6 py-3">

        {/* ── LEFT: accent line + greeting label + name + sub ── */}
        <div className="flex min-w-0 gap-3.5 items-start">
          {/* Vertical accent bar — replaces the top strip on the old card */}
          <span
            aria-hidden="true"
            className="mt-1 shrink-0 w-[3px] h-12 rounded-full self-stretch"
            style={{ backgroundColor: accent.strip }}
          />

          <div className="flex flex-col gap-0.5 min-w-0">
            {/* e.g. GOOD MORNING */}
            <span
              className="gb-up text-[11px] font-bold tracking-[0.8px] uppercase leading-none"
              style={{ color: accent.label }}
            >
              {greeting.text}
            </span>

            {/* Name + emoji — larger, bold */}
            <h1
              className="gb-up text-[22px] font-semibold tracking-tight leading-snug flex items-baseline gap-1.5 truncate"
              style={{ animationDelay: "0.05s" }}
            >
              {firstName}
              <span role="img" aria-label="greeting" className="text-[20px]">
                {greeting.emoji}
              </span>
            </h1>

            {/* Sub-line copy */}
            <p
              className="gb-up text-sm text-muted-foreground leading-snug truncate"
              style={{ animationDelay: "0.1s" }}
            >
              {greeting.sub}
            </p>
          </div>
        </div>

        {/* ── RIGHT: clock + badges — always aligned to the far right ── */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {/* Live clock */}
          {time && (
            <span className="text-lg font-medium tabular-nums tracking-tight text-foreground leading-none">
              {time}
            </span>
          )}

          {/* Role + department pills */}
          {(role || department) && (
            <div className="flex items-center gap-1.5">
              {role && (
                <span
                  className="gb-pop text-[11px] font-semibold px-2.5 py-[3px] rounded-full border"
                  style={{
                    backgroundColor: accent.roleBg,
                    borderColor:     accent.roleBorder,
                    color:           accent.roleText,
                  }}
                >
                  {role.toUpperCase()}
                </span>
              )}
              {department && (
                <span
                  className="gb-pop2 text-[11px] font-semibold px-2.5 py-[3px] rounded-full border"
                  style={{
                    backgroundColor: accent.deptBg,
                    borderColor:     accent.deptBorder,
                    color:           accent.deptText,
                  }}
                >
                  {department}
                </span>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}