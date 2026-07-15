"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import {
  listOwnerNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type OwnerNotification,
} from "../notifications-actions";

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

export default function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<OwnerNotification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      const rows = await listOwnerNotifications();
      setItems(rows);
      setLoading(false);
    }
  }

  async function handleItemClick(n: OwnerNotification) {
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
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} weight="regular" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-primary-500 text-white text-[9px] font-bold leading-none flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-neutral-100 bg-white shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-100">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-xs text-neutral-400 text-center">Loading…</p>
            ) : !items || items.length === 0 ? (
              <p className="px-3 py-6 text-xs text-neutral-400 text-center">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className="flex items-start gap-2.5 w-full px-3 py-2.5 text-left border-b border-neutral-50 last:border-b-0 hover:bg-neutral-50 transition-colors"
                >
                  <span
                    className={`mt-1.5 size-1.5 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-primary-500"}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-neutral-800 truncate">{n.title}</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{n.body}</span>
                    <span className="block text-[10px] text-neutral-400 mt-1">{timeAgo(n.createdAt)}</span>
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
