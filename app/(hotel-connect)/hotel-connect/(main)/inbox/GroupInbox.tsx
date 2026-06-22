"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChatCircleDotsIcon,
  PaperPlaneTiltIcon,
  MagnifyingGlassIcon,
  XIcon,
  DotsThreeVerticalIcon,
  PaperclipIcon,
  ArrowLeftIcon,
  BuildingsIcon,
  UsersThreeIcon,
  SealCheckIcon,
  BellIcon,
  CheckCircleIcon,
  LightningIcon,
} from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageSender = "guest" | "host" | "system";

type Message = {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  read?: boolean;
};

type ConversationTag = "booking" | "inquiry" | "support";

type Conversation = {
  id: string;
  type: "guest" | "support";
  name: string;
  bookingNumber: string | null;
  property: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  tag: ConversationTag;
  messages: Message[];
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK: Conversation[] = [
  {
    id: "c1",
    type: "guest",
    name: "Rohan Sharma",
    bookingNumber: "DY78234",
    property: "Himalayan Retreat & Spa",
    lastMessage: "What time is check-in? I'll be arriving from Delhi around noon.",
    timestamp: "2m ago",
    unread: 2,
    tag: "booking",
    messages: [
      { id: "m1", sender: "guest",  text: "Hi! I just confirmed my booking for next weekend. Super excited!", time: "10:00 AM" },
      { id: "m2", sender: "host",   text: "Welcome, Rohan! We're delighted to have you. Please don't hesitate to ask if there's anything we can arrange before your arrival.", time: "10:08 AM", read: true },
      { id: "m3", sender: "guest",  text: "Thanks! Quick question — what time is check-in? I'll be arriving from Delhi around noon.", time: "10:22 AM" },
      { id: "m4", sender: "guest",  text: "Also, is parking available at the property?", time: "10:23 AM" },
    ],
  },
  {
    id: "c2",
    type: "guest",
    name: "Priya & Ravi Kapoor",
    bookingNumber: "DY78190",
    property: "Himalayan Retreat & Spa",
    lastMessage: "We'd love an early check-in if possible, around 11 AM.",
    timestamp: "1h ago",
    unread: 0,
    tag: "booking",
    messages: [
      { id: "m1", sender: "guest",  text: "Hello! We're a couple celebrating our anniversary. Could we request an early check-in around 11 AM?", time: "Yesterday 3:45 PM" },
      { id: "m2", sender: "host",   text: "Congratulations on your anniversary! We'll do our best to have your room ready by 11 AM. We'll confirm closer to your arrival date.", time: "Yesterday 4:10 PM", read: true },
      { id: "m3", sender: "guest",  text: "Thank you so much! Also, could you arrange some flowers and a small cake in the room?", time: "Yesterday 4:20 PM" },
      { id: "m4", sender: "host",   text: "Absolutely! That sounds lovely. We'll arrange a floral decoration and a complimentary cake. Please share any dietary preferences.", time: "Yesterday 4:35 PM", read: true },
      { id: "m5", sender: "guest",  text: "We'd love an early check-in if possible, around 11 AM.", time: "Yesterday 4:40 PM" },
    ],
  },
  {
    id: "c3",
    type: "support",
    name: "DreamsYatri Support",
    bookingNumber: null,
    property: "All Properties",
    lastMessage: "Your property listing has been approved and is now live.",
    timestamp: "3h ago",
    unread: 1,
    tag: "support",
    messages: [
      { id: "m1", sender: "system", text: "Verification update from DreamsYatri", time: "Today 9:00 AM" },
      { id: "m2", sender: "guest",  text: "Hi Suraj, great news! Our team has reviewed your property submission and everything looks good.", time: "Today 9:00 AM" },
      { id: "m3", sender: "guest",  text: "Your property listing has been approved and is now live on DreamsYatri. Travellers can now discover and book your property.", time: "Today 9:01 AM" },
    ],
  },
  {
    id: "c4",
    type: "guest",
    name: "Amit Verma",
    bookingNumber: null,
    property: "Himalayan Retreat & Spa",
    lastMessage: "We're a group of 15 — can you accommodate us in Jan?",
    timestamp: "2d ago",
    unread: 0,
    tag: "inquiry",
    messages: [
      { id: "m1", sender: "guest",  text: "Hello, we are planning a family trip to Manali in January. Our group is 15 people — 10 adults and 5 children.", time: "2d ago" },
      { id: "m2", sender: "host",   text: "Hi Amit! We'd love to host your group. We have enough rooms to accommodate 15 guests. Could you share your preferred dates so we can check availability?", time: "2d ago", read: true },
      { id: "m3", sender: "guest",  text: "We're thinking 12–16 January. Do you have group rates?", time: "2d ago" },
      { id: "m4", sender: "host",   text: "Yes, we offer a 10% group discount for parties of 10+. I'll send a detailed quote to your registered email shortly.", time: "2d ago", read: true },
      { id: "m5", sender: "guest",  text: "We're a group of 15 — can you accommodate us in Jan?", time: "2d ago" },
    ],
  },
  {
    id: "c5",
    type: "guest",
    name: "Sneha Gupta",
    bookingNumber: "DY77908",
    property: "Himalayan Retreat & Spa",
    lastMessage: "We're strictly vegetarian. Could you ensure no non-veg in our room?",
    timestamp: "3d ago",
    unread: 0,
    tag: "booking",
    messages: [
      { id: "m1", sender: "guest",  text: "Hi, I noticed the meal plan includes breakfast and dinner. We're strictly vegetarian — could you confirm no non-vegetarian food is served?", time: "3d ago" },
      { id: "m2", sender: "host",   text: "Absolutely, Sneha! We have a dedicated vegetarian kitchen and can ensure all your meals are 100% vegetarian. We'll also add a note to your booking.", time: "3d ago", read: true },
      { id: "m3", sender: "guest",  text: "We're strictly vegetarian. Could you ensure no non-veg is used even for cooking oils or preparation?", time: "3d ago" },
    ],
  },
  {
    id: "c6",
    type: "guest",
    name: "Ravi Mehta",
    bookingNumber: "DY77341",
    property: "Himalayan Retreat & Spa",
    lastMessage: "What is your cancellation policy if I need to change dates?",
    timestamp: "5d ago",
    unread: 0,
    tag: "booking",
    messages: [
      { id: "m1", sender: "guest",  text: "Hi, I may need to change my travel dates due to work. What is your cancellation policy?", time: "5d ago" },
      { id: "m2", sender: "host",   text: "Hi Ravi! For date changes made 7+ days before check-in, we allow one free modification. After that, a small fee applies. Would you like to know the new dates first?", time: "5d ago", read: true },
      { id: "m3", sender: "guest",  text: "What is your cancellation policy if I need to change dates?", time: "5d ago" },
    ],
  },
];

const QUICK_REPLIES = [
  "Check-in is at 2:00 PM",
  "We'll arrange this for you",
  "Thank you for choosing us!",
  "Let us know your ETA",
  "Please contact +91-XXXXX",
];

const TAG_CONFIG: Record<ConversationTag, { label: string; className: string }> = {
  booking: { label: "Booking",  className: "bg-blue-50 text-blue-600"    },
  inquiry: { label: "Inquiry",  className: "bg-violet-50 text-violet-600" },
  support: { label: "Support",  className: "bg-amber-50 text-amber-600"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationItem({
  convo,
  active,
  onClick,
}: {
  convo: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const tag = TAG_CONFIG[convo.tag];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-neutral-100 transition-colors",
        active ? "bg-primary-50" : "hover:bg-neutral-50",
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold relative",
        convo.type === "support" ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-600",
      )}>
        {convo.type === "support" ? "DY" : initials(convo.name)}
        {convo.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
            {convo.unread}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={cn("text-sm truncate", convo.unread > 0 ? "font-bold text-neutral-900" : "font-medium text-neutral-700")}>
            {convo.name}
          </p>
          <span className="text-[10px] text-neutral-400 shrink-0">{convo.timestamp}</span>
        </div>
        <p className="text-xs text-neutral-400 truncate mb-1.5">{convo.lastMessage}</p>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full", tag.className)}>
            {tag.label}
          </span>
          <span className="text-[10px] text-neutral-300 truncate">{convo.property}</span>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.sender === "system") {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full font-medium">
          {msg.text}
        </span>
      </div>
    );
  }

  const isHost = msg.sender === "host";
  return (
    <div className={cn("flex gap-2 mb-2", isHost ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
        isHost
          ? "bg-primary-500 text-white rounded-tr-sm"
          : "bg-white border border-neutral-100 text-neutral-800 rounded-tl-sm shadow-xs",
      )}>
        {msg.text}
        <div className={cn("flex items-center gap-1 mt-1", isHost ? "justify-end" : "justify-start")}>
          <span className={cn("text-[10px]", isHost ? "text-primary-200" : "text-neutral-300")}>
            {msg.time}
          </span>
          {isHost && (
            <CheckCircleIcon
              size={10}
              weight={msg.read ? "fill" : "regular"}
              className={msg.read ? "text-primary-200" : "text-primary-300"}
            />
          )}
        </div>
      </div>
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

export default function GroupInbox() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "unread" | "bookings" | "support">("all");
  const [message, setMessage]   = useState("");
  const [showList, setShowList] = useState(true); // mobile: toggle between list/thread
  const messagesEndRef           = useRef<HTMLDivElement>(null);

  const active = MOCK.find((c) => c.id === activeId) ?? null;

  const filtered = MOCK.filter((c) => {
    const matchSearch = search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.bookingNumber?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchFilter =
      filter === "all"      ? true :
      filter === "unread"   ? c.unread > 0 :
      filter === "bookings" ? c.tag === "booking" :
      filter === "support"  ? c.tag === "support" : true;
    return matchSearch && matchFilter;
  });

  const totalUnread = MOCK.reduce((s, c) => s + c.unread, 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId]);

  function selectConversation(id: string) {
    setActiveId(id);
    setShowList(false); // mobile: show thread
  }

  function handleSend() {
    if (!message.trim()) return;
    setMessage("");
    // In real implementation, would call server action
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

        {/* Search + header */}
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

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <XIcon size={12} className="text-neutral-400" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {([
              { id: "all",      label: "All"      },
              { id: "unread",   label: "Unread"   },
              { id: "bookings", label: "Bookings" },
              { id: "support",  label: "Support"  },
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

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <ConversationItem
                key={c.id}
                convo={c}
                active={c.id === activeId}
                onClick={() => selectConversation(c.id)}
              />
            ))
          ) : (
            <div className="py-12 text-center px-4">
              <ChatCircleDotsIcon size={28} weight="duotone" className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No conversations found</p>
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
            {/* Thread header */}
            <div className="shrink-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
              {/* Mobile back */}
              <button
                className="md:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
                onClick={() => setShowList(true)}
              >
                <ArrowLeftIcon size={15} weight="bold" />
              </button>

              {/* Avatar */}
              <div className={cn(
                "size-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                active.type === "support" ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-600",
              )}>
                {active.type === "support" ? "DY" : initials(active.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{active.name}</p>
                  {active.type === "support" && (
                    <SealCheckIcon size={14} weight="fill" className="text-primary-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {active.bookingNumber && (
                    <span className="text-[10px] font-mono bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                      #{active.bookingNumber}
                    </span>
                  )}
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1 truncate">
                    <BuildingsIcon size={10} className="shrink-0" />
                    {active.property}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors">
                  <BellIcon size={16} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors">
                  <DotsThreeVerticalIcon size={16} />
                </button>
              </div>
            </div>

            {/* Booking context pill (if booking convo) */}
            {active.bookingNumber && (
              <div className="shrink-0 mx-4 mt-3 mb-1">
                <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                  <CheckCircleIcon size={14} weight="fill" className="text-blue-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-blue-800">Booking #{active.bookingNumber}</p>
                    <p className="text-[10px] text-blue-500 truncate">{active.property}</p>
                  </div>
                  <button className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 shrink-0 flex items-center gap-0.5">
                    View booking
                    <svg className="inline w-2.5 h-2.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
              {active.messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick replies */}
            <div className="shrink-0 px-4 pb-2 pt-1 flex gap-2 overflow-x-auto scrollbar-none">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  onClick={() => setMessage(reply)}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <LightningIcon size={10} weight="fill" className="text-primary-400" />
                  {reply}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div className="shrink-0 bg-white border-t border-neutral-200 px-4 py-3">
              <div className="flex items-end gap-2">
                <button className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors mb-0.5">
                  <PaperclipIcon size={16} />
                </button>

                <div className="flex-1 min-w-0">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full resize-none px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all max-h-28 overflow-y-auto"
                    style={{ minHeight: "40px" }}
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className={cn(
                    "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all mb-0.5",
                    message.trim()
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
