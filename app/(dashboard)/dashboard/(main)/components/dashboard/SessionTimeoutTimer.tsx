"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { signOutEmployee } from "@/app/lib/auth-dashboard-actions";

const WARNING_WINDOW_MS = 2 * 60 * 60 * 1000; // start warning 2 hours before session expiry

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function SessionTimeoutTimer({ expiresAt }: { expiresAt: string }) {
  const expiryTime = new Date(expiresAt).getTime();
  const [remainingMs, setRemainingMs] = useState(() => expiryTime - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(expiryTime - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiryTime]);

  useEffect(() => {
    // Fires the actual sign-out once the session clock runs out — the
    // countdown alone doesn't invalidate the cookie, this does.
    if (remainingMs <= 0) signOutEmployee();
  }, [remainingMs]);

  if (remainingMs > WARNING_WINDOW_MS || remainingMs <= 0) return null;

  return (
    <div className="flex items-center justify-center gap-2.5 bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      <span className="text-neutral-300">
        You&apos;ll be logged out in
      </span>
      <span className="rounded-md bg-amber-400/15 px-2 py-0.5 font-mono font-semibold tabular-nums tracking-wide text-amber-400">
        {formatDuration(remainingMs)}
      </span>
      <span className="text-neutral-300">
        — please save your work and log in again.
      </span>
    </div>
  );
}
