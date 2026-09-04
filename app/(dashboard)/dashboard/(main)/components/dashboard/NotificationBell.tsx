"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { useMemberNotifications } from "@/app/lib/ably-client";
import {
  listMyNotifications, markNotificationRead, markAllNotificationsRead, type NotificationRow,
} from "../../lib/notifications-actions";

/** Header bell — every event that used to only show a toast (package
 * approved/rejected by costing, a hotel request filled/rejected, …) now
 * lands here too, so it survives a reload and isn't missed just because
 * nobody was looking at the screen when it happened.
 *
 * The unread count and the list both start from what the layout already
 * fetched server-side (no loading flash on first paint), then stay live
 * over the same private-channel-per-member Ably wiring the chat and
 * verification-count badges use — a new row shows up the moment it's
 * written, no poll, no manual refresh. */
export function NotificationBell({
  memberId, initialUnreadCount,
}: {
  memberId: string;
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, startLoadMore] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useMemberNotifications(memberId, (n) => {
    setUnreadCount((c) => c + 1);
    // Only the panel's own already-loaded list grows — a closed/never-opened
    // panel just carries the higher count until someone actually opens it,
    // rather than eagerly loading a list nobody's looking at yet.
    setItems((prev) => (prev ? [{ ...n, readAt: null }, ...prev] : prev));

    // A lead request landing in the queue is time-sensitive for whoever
    // reviews it — surfaced as a toast (on top of the bell) so it isn't
    // missed just because the panel is closed.
    if (n.type === "LEAD_REQUEST_SUBMITTED") {
      toast.info(n.title, {
        description: n.body ?? undefined,
        action: n.link ? { label: "Review", onClick: () => router.push(n.link!) } : undefined,
      });
    }
  });

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      const { rows, hasMore: more } = await listMyNotifications();
      setItems(rows);
      setHasMore(more);
      setLoading(false);
    }
  }

  function loadMore() {
    if (!items || items.length === 0) return;
    const cursor = items[items.length - 1].id;
    startLoadMore(async () => {
      const { rows, hasMore: more } = await listMyNotifications(cursor);
      setItems((prev) => [...(prev ?? []), ...rows]);
      setHasMore(more);
    });
  }

  async function handleItemClick(n: NotificationRow) {
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
        aria-label="Notifications"
        aria-expanded={open}
        className="relative h-11 w-11 flex items-center justify-center rounded-full text-dashboard-base-content/60 hover:bg-dashboard-base-200 hover:text-dashboard-base-content transition-colors cursor-pointer"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-dashboard-error text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-dashboard-base-100">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[calc(100vw-2rem)] max-w-[22rem] sm:w-96 rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-dashboard-base-300">
            <p className="text-sm font-semibold text-dashboard-base-content">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button" onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:text-dashboard-primary/80 cursor-pointer"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-8 text-xs text-dashboard-base-content/40 text-center">Loading…</p>
            ) : !items || items.length === 0 ? (
              <p className="px-3 py-8 text-xs text-dashboard-base-content/40 text-center">You&apos;re all caught up.</p>
            ) : (
              <>
                {items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className="flex items-start gap-2.5 w-full px-3.5 py-3 text-left border-b border-dashboard-base-300/60 last:border-b-0 hover:bg-dashboard-base-200/50 transition-colors cursor-pointer"
                  >
                    <span
                      className={cn("mt-1.5 size-1.5 rounded-full shrink-0", n.readAt ? "bg-transparent" : "bg-dashboard-primary")}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold text-dashboard-base-content truncate">{n.title}</span>
                      {n.body && (
                        <span className="block text-[11px] text-dashboard-base-content/60 mt-0.5 line-clamp-2">{n.body}</span>
                      )}
                      <span className="block text-[10px] text-dashboard-base-content/40 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-medium text-dashboard-primary hover:bg-dashboard-base-200/50 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 size={13} className="animate-spin" />}
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
