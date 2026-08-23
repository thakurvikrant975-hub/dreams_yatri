"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type TeamNotificationRow,
} from "../../notifications-actions";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const SEVERITY_DOT: Record<string, string> = {
  LOW: "bg-dashboard-info",
  MEDIUM: "bg-dashboard-warning",
  HIGH: "bg-dashboard-error",
  CRITICAL: "bg-dashboard-error",
};

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<TeamNotificationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Poll the unread count so the badge stays current even while the panel's closed —
  // the panel's own list is only fetched lazily on first open, same as the hotel-owner bell.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { getMyUnreadNotificationCount } = await import("../../notifications-actions");
        setUnreadCount(await getMyUnreadNotificationCount());
      } catch {
        // ignore — next poll will retry
      }
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setItems(await listMyNotifications());
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleItemClick(n: TeamNotificationRow) {
    if (!n.readAt) {
      setItems((prev) => prev?.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? null);
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationRead(n.id);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? null);
    setUnreadCount(0);
    await markAllNotificationsRead();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-dashboard-base-content/60 hover:bg-dashboard-base-200 hover:text-dashboard-base-content transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-dashboard-primary text-white text-[9px] font-bold leading-none flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-dashboard-base-100 shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:opacity-80 transition-opacity"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-xs text-dashboard-base-content/50 text-center">Loading…</p>
            ) : !items || items.length === 0 ? (
              <p className="px-3 py-6 text-xs text-dashboard-base-content/50 text-center">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className="flex items-start gap-2.5 w-full px-3 py-2.5 text-left border-b last:border-b-0 hover:bg-dashboard-base-200 transition-colors"
                >
                  <span
                    className={`mt-1.5 size-1.5 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : SEVERITY_DOT[n.severity] ?? "bg-dashboard-primary"}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold truncate">{n.title}</span>
                    <span className="block text-[11px] text-dashboard-base-content/60 mt-0.5 line-clamp-2">{n.body}</span>
                    <span className="block text-[10px] text-dashboard-base-content/40 mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
