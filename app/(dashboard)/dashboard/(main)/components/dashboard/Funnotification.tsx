// app/dashboard/components/shared/FunNotification.tsx
"use client";

/**
 * FunNotification
 * ─────────────────────────────────────────────────────────────────────────────
 * Rules:
 *  1. Shown to exactly 50% of employees (deterministic per memberId + ISO week)
 *  2. Visible for only 2 hours from the "show window" start of that week
 *  3. Show window = Monday 10:00 AM of each ISO week (arbitrary but consistent)
 *  4. Dismissed = never shown again for that week (localStorage)
 *  5. Rotates messages based on (week number) so the whole team sees the same
 *     message that week (but only half of them actually see it)
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/app/lib/utils";

const FUN_MESSAGES = [
  {
    emoji: "☕",
    title: "You absolute legend.",
    body: "You've followed up more times than we refresh our chai. Here's a virtual cup — you've earned it.",
  },
  {
    emoji: "🚀",
    title: "Alert: Productivity spike detected.",
    body: "Our servers are confused. They've never seen a human work this efficiently. Please slow down before HR asks questions.",
  },
  {
    emoji: "🏔️",
    title: "Fun fact about you.",
    body: "You've handled more queries than the number of peaks in Himachal. Respect.",
  },
  {
    emoji: "📞",
    title: "Your phone is tired.",
    body: "It filed a complaint with HR. It says you call too many clients. We told it that's the job. It hung up on us.",
  },
  {
    emoji: "🎯",
    title: "Conversion machine spotted.",
    body: "Scientists are baffled. You turn cold leads into confirmed bookings faster than we can say 'Kashmir package'.",
  },
  {
    emoji: "🌊",
    title: "Riding the wave.",
    body: "You're so good at follow-ups, leads actually look forward to your calls. That's unnatural. We love it.",
  },
  {
    emoji: "🧠",
    title: "Big brain energy.",
    body: "You remembered a client's travel date from 3 weeks ago without looking it up. Are you even human?",
  },
  {
    emoji: "🎪",
    title: "Today's vibe check: PASSED.",
    body: "You walked in, opened your dashboard, and immediately started closing. No warmup. No mercy. Iconic.",
  },
  {
    emoji: "🦁",
    title: "The office apex predator.",
    body: "Targets? Demolished. Follow-ups? Done. Chai? Cold because you forgot it while converting a lead. This is fine.",
  },
  {
    emoji: "✈️",
    title: "You plan trips you'll never take.",
    body: "You've built so many Kashmir itineraries, you basically live there. Spiritually. Professionally. Mentally.",
  },
];

/** ISO week number (Mon-based) */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Monday 10am of the current ISO week (UTC+5:30 aware via offset) */
function getWeekWindowStart(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1));             // rewind to Monday
  d.setHours(10, 0, 0, 0);                        // 10:00 AM local
  return d;
}

/** Cheap deterministic hash for a string — returns 0..N */
function hashStringToRange(str: string, N: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % N;
}

interface FunNotificationProps {
  memberId: string;
}

export function FunNotification({ memberId }: FunNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<(typeof FUN_MESSAGES)[number] | null>(null);

  useEffect(() => {
    const now = new Date();
    const week = getISOWeek(now);
    const year = now.getFullYear();
    const weekKey = `fun-notif-${year}-W${week}`;

    // Already dismissed this week
    if (localStorage.getItem(weekKey) === "dismissed") return;

    // 50% gate — deterministic per member + week
    const seed = `${memberId}-${year}-${week}`;
    const bucket = hashStringToRange(seed, 2); // 0 or 1
    if (bucket !== 0) return; // only bucket 0 sees it

    // 2-hour window from Monday 10am
    const windowStart = getWeekWindowStart(now);
    const windowEnd = new Date(windowStart.getTime() + 2 * 60 * 60 * 1000);
    if (now < windowStart || now > windowEnd) return;

    // Pick message for this week (same for everyone who sees it)
    const msgIndex = hashStringToRange(`${year}-${week}`, FUN_MESSAGES.length);
    setMessage(FUN_MESSAGES[msgIndex]);
    setVisible(true);
  }, [memberId]);

  const dismiss = () => {
    const now = new Date();
    const week = getISOWeek(now);
    const year = now.getFullYear();
    localStorage.setItem(`fun-notif-${year}-W${week}`, "dismissed");
    setVisible(false);
  };

  if (!visible || !message) return null;

  return (
    <div
      className={cn(
        "relative flex items-start gap-4 rounded-xl border border-primary/20",
        "bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent",
        "px-4 py-3.5 animate-in slide-in-from-top-2 duration-500"
      )}
    >
      <span className="text-2xl leading-none mt-0.5" role="img" aria-label="fun">
        {message.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{message.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{message.body}</p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}