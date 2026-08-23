"use client";

import { useEffect } from "react";
import { heartbeat } from "../../heartbeat-actions";

const PING_INTERVAL_MS = 60 * 1000;

/** Keeps TeamMember.lastHeartbeatAt fresh while this tab is open and
 * active — the dashboard-inactivity SLA rule (sla-sweep.service.ts)
 * auto-logs out anyone whose heartbeat goes 15 min stale. Only pings while
 * the tab is actually visible, so switching away/minimizing lets the
 * inactivity clock run for real instead of resetting every minute in the
 * background. */
export function IdleHeartbeat() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState === "visible") heartbeat().catch(() => {});
    }

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
