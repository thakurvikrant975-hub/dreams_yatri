"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  ChatCircleDotsIcon,
  PaperPlaneTiltIcon,
  MagnifyingGlassIcon,
  XIcon,
  ArrowLeftIcon,
  BuildingsIcon,
  CheckCircleIcon,
  LightningIcon,
  WarningIcon,
  PaperclipIcon,
  FileIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import { useConversationChannel } from "@/app/lib/ably-client";
import {
  getConversationMessages,
  sendHostMessage,
  sendHostAttachment,
  deleteHostMessage,
  markConversationRead,
  type ConversationSummary,
  type ConversationMessage,
} from "./inbox-actions";

const QUICK_REPLIES = [
  "Check-in is at 2:00 PM",
  "We'll arrange this for you",
  "Thank you for choosing us!",
  "Let us know your ETA",
  "Please contact +91-XXXXX",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "G";
}

function key(c: { bookingId: string; hotelId: number }) {
  return `${c.bookingId}:${c.hotelId}`;
}

function formatTime(d: Date) {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationItem({
  convo,
  active,
  onClick,
}: {
  convo: ConversationSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-neutral-100 transition-colors",
        active ? "bg-primary-50" : "hover:bg-neutral-50",
      )}
    >
      <div className="size-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold relative bg-neutral-100 text-neutral-600">
        {initials(convo.guestName)}
        {convo.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
            {convo.unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={cn("text-sm truncate", convo.unreadCount > 0 ? "font-bold text-neutral-900" : "font-medium text-neutral-700")}>
            {convo.guestName}
          </p>
          {convo.lastMessageAt && (
            <span className="text-[10px] text-neutral-400 shrink-0">{formatTime(convo.lastMessageAt)}</span>
          )}
        </div>
        <p className="text-xs text-neutral-400 truncate mb-1.5">
          {convo.lastMessage ?? "No messages yet"}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
            #{convo.bookingNumber}
          </span>
          <span className="text-[10px] text-neutral-300 truncate">{convo.hotelName}</span>
        </div>
      </div>
    </button>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentCard({ msg }: { msg: ConversationMessage }) {
  if (!msg.attachmentUrl) return null;
  const isImage = msg.attachmentType?.startsWith("image/");
  if (isImage) {
    return (
      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-1.5 -mx-1 -mt-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- chat attachment thumbnails are arbitrary-sized uploads */}
        <img src={msg.attachmentUrl} alt={msg.attachmentName ?? "Attachment"} className="max-h-48 w-auto rounded-lg object-cover" />
      </a>
    );
  }
  return (
    <a
      href={msg.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 hover:bg-black/10 transition-colors"
    >
      <FileIcon size={18} weight="fill" className="shrink-0 opacity-70" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{msg.attachmentName ?? "File"}</span>
        {msg.attachmentSize != null && <span className="block text-[10px] opacity-70">{formatBytes(msg.attachmentSize)}</span>}
      </span>
    </a>
  );
}

function MessageBubble({ msg, isMine, onDelete }: { msg: ConversationMessage; isMine: boolean; onDelete: (id: number) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (msg.sender === "SYSTEM") {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full font-medium">
          {msg.body}
        </span>
      </div>
    );
  }

  const isHost = msg.sender === "HOST";

  if (msg.isDeleted) {
    return (
      <div className={cn("flex gap-2 mb-2", isHost ? "flex-row-reverse" : "flex-row")}>
        <div className="max-w-[70%] px-4 py-2.5 rounded-2xl text-xs italic text-neutral-400 bg-neutral-50 border border-neutral-100">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group flex gap-1.5 mb-2 items-center", isHost ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "relative max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
        isHost
          ? "bg-primary-500 text-white rounded-tr-sm"
          : "bg-white border border-neutral-100 text-neutral-800 rounded-tl-sm shadow-xs",
      )}>
        <AttachmentCard msg={msg} />
        {msg.body}
        <div className={cn("flex items-center gap-1 mt-1", isHost ? "justify-end" : "justify-start")}>
          <span className={cn("text-[10px]", isHost ? "text-primary-200" : "text-neutral-300")}>
            {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      </div>
      {isMine && (
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Message options"
            className="flex size-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
          >
            <DotsThreeVerticalIcon size={14} weight="bold" />
          </button>
          {menuOpen && (
            <div className="absolute z-10 top-full mt-1 right-0 rounded-lg border border-neutral-200 bg-white shadow-md py-1 min-w-[110px]">
              <button
                onClick={() => { setMenuOpen(false); onDelete(msg.id); }}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <TrashIcon size={13} weight="bold" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyThreadState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
      <div className="size-16 rounded-2xl bg-neutral-100 flex items-center justify-center">
        <ChatCircleDotsIcon size={28} weight="duotone" className="text-neutral-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-700 mb-1">Select a conversation</p>
        <p className="text-xs text-neutral-400 max-w-[180px] leading-relaxed">
          Choose a conversation from the list to view messages and reply.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GroupInbox({ initialConversations }: { initialConversations: ConversationSummary[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [showList, setShowList] = useState(true); // mobile: toggle between list/thread
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = conversations.find((c) => key(c) === activeKey) ?? null;

  const filtered = conversations.filter((c) => {
    const matchSearch = search === "" ||
      c.guestName.toLowerCase().includes(search.toLowerCase()) ||
      c.bookingNumber.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : c.unreadCount > 0;
    return matchSearch && matchFilter;
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeKey, messages.length]);

  // Upsert by id — a live-delivered update (e.g. a delete) replaces the
  // matching bubble in place instead of only ever appending new ones.
  function upsertMessage(prev: ConversationMessage[], incoming: ConversationMessage): ConversationMessage[] {
    const idx = prev.findIndex((m) => m.id === incoming.id);
    if (idx === -1) return [...prev, incoming];
    const next = prev.slice();
    next[idx] = incoming;
    return next;
  }

  // Live delivery for the open thread — a guest's message (or the host's own
  // send from another tab/device) appears without reopening the conversation.
  useConversationChannel(active?.bookingId ?? null, active?.hotelId ?? null, (msg) => {
    if (!active) return;
    setMessages((prev) => upsertMessage(prev, { ...msg, createdAt: new Date(msg.createdAt) }));
    setConversations((prev) => prev.map((x) =>
      key(x) === key(active) ? { ...x, lastMessage: msg.body, lastMessageAt: new Date(msg.createdAt) } : x
    ));
    if (msg.sender === "GUEST") {
      markConversationRead(active.bookingId, active.hotelId).catch(() => {});
    }
  });

  function selectConversation(c: ConversationSummary) {
    setActiveKey(key(c));
    setShowList(false); // mobile: show thread
    setSendError(null);
    setMessagesLoading(true);
    getConversationMessages(c.bookingId, c.hotelId).then((res) => {
      setMessages(res.messages ?? []);
      setMessagesLoading(false);
      if (c.unreadCount > 0) {
        setConversations((prev) => prev.map((x) => (key(x) === key(c) ? { ...x, unreadCount: 0 } : x)));
      }
    });
  }

  function handleSend() {
    const body = draft.trim();
    if (!body || !active) return;
    setSendError(null);
    startSending(async () => {
      const result = await sendHostMessage(active.bookingId, active.hotelId, body);
      if (result.error) {
        setSendError(result.error);
        return;
      }
      if (result.message) {
        const sent = result.message;
        setMessages((prev) => upsertMessage(prev, sent));
        setConversations((prev) => prev.map((x) =>
          key(x) === key(active)
            ? { ...x, lastMessage: sent.body, lastMessageAt: sent.createdAt }
            : x
        ));
      }
      setDraft("");
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    setUploading(true);
    setSendError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await sendHostAttachment(active.bookingId, active.hotelId, fd);
      if (res.error) {
        setSendError(res.error);
      } else if (res.message) {
        const sent = res.message;
        setMessages((prev) => upsertMessage(prev, sent));
        setConversations((prev) => prev.map((x) =>
          key(x) === key(active) ? { ...x, lastMessage: sent.body, lastMessageAt: sent.createdAt } : x
        ));
      }
    } catch (err) {
      console.error("[GroupInbox] attachment upload failed", err);
      setSendError("Could not send the file. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleDelete(messageId: number) {
    if (!active || !window.confirm("Delete this message for everyone?")) return;
    const prevMessages = messages;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: "", attachmentUrl: null } : m)));
    deleteHostMessage(active.bookingId, active.hotelId, messageId).then((res) => {
      if (res.error) {
        setSendError(res.error);
        setMessages(prevMessages);
      }
    });
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">

      {/* ── Left: conversation list ──────────────────────────── */}
      <div className={cn(
        "flex flex-col border-r border-neutral-200 bg-white shrink-0",
        "w-full md:w-80 lg:w-96",
        !showList && "hidden md:flex",
        showList && "flex",
      )}>

        <div className="px-4 pt-4 pb-3 border-b border-neutral-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-neutral-800">Messages</p>
              {totalUnread > 0 && (
                <span className="text-[10px] font-bold bg-primary-500 text-white px-1.5 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by guest or booking #..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <XIcon size={12} className="text-neutral-400" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {([
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  filter === t.id
                    ? "bg-primary-500 text-white"
                    : "text-neutral-500 hover:bg-neutral-100",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <ConversationItem
                key={key(c)}
                convo={c}
                active={key(c) === activeKey}
                onClick={() => selectConversation(c)}
              />
            ))
          ) : (
            <div className="py-12 text-center px-4">
              <ChatCircleDotsIcon size={28} weight="duotone" className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">
                {conversations.length === 0 ? "No bookings to message about yet" : "No conversations found"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: conversation thread ───────────────────────── */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden bg-neutral-50",
        showList && !active && "hidden md:flex",
        !showList && "flex",
      )}>
        {active ? (
          <>
            <div className="shrink-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
              <button
                className="md:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
                onClick={() => setShowList(true)}
                aria-label="Back to conversation list"
              >
                <ArrowLeftIcon size={15} weight="bold" aria-hidden="true" />
              </button>

              <div className="size-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold bg-neutral-100 text-neutral-600">
                {initials(active.guestName)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-800 truncate">{active.guestName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                    #{active.bookingNumber}
                  </span>
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1 truncate">
                    <BuildingsIcon size={10} className="shrink-0" />
                    {active.hotelName}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 mx-4 mt-3 mb-1">
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                <CheckCircleIcon size={14} weight="fill" className="text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-blue-800">Booking #{active.bookingNumber}</p>
                  <p className="text-[10px] text-blue-500 truncate">{active.hotelName}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-neutral-400">Loading messages…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-neutral-400">No messages yet — say hello!</p>
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} isMine={msg.sender === "HOST"} onDelete={handleDelete} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 px-4 pb-2 pt-1 flex gap-2 overflow-x-auto scrollbar-none">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  onClick={() => setDraft(reply)}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <LightningIcon size={10} weight="fill" className="text-primary-400" />
                  {reply}
                </button>
              ))}
            </div>

            {sendError && (
              <div className="shrink-0 mx-4 mb-1 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <WarningIcon size={12} weight="fill" />
                {sendError}
              </div>
            )}

            <div className="shrink-0 bg-white border-t border-neutral-200 px-4 py-3">
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Attach file"
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 transition-colors mb-0.5"
                >
                  <PaperclipIcon size={17} weight="bold" />
                </button>

                <div className="flex-1 min-w-0">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message..."
                    rows={1}
                    maxLength={4000}
                    className="w-full resize-none px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all max-h-28 overflow-y-auto"
                    style={{ minHeight: "40px" }}
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || isSending}
                  className={cn(
                    "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all mb-0.5",
                    draft.trim() && !isSending
                      ? "bg-primary-500 text-white hover:bg-primary-600 shadow-sm"
                      : "bg-neutral-100 text-neutral-300 cursor-not-allowed",
                  )}
                >
                  <PaperPlaneTiltIcon size={15} weight="fill" />
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1.5 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          <EmptyThreadState />
        )}
      </div>
    </div>
  );
}
