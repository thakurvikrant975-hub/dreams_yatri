"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserMessage {
  id: number;
  role: "user";
  text: string;
  delay: number;
}

interface AiMessage {
  id: number;
  role: "ai";
  delay: number;
  packages: Package[];
  intro: string;
  outro: string;
}

interface Package {
  label: string;
  name: string;
  price: string;
}

type ChatMessage = UserMessage | AiMessage;

interface FeatureItemProps {
  text: string;
  visible: boolean;
  index: number;
}

interface AiMessageBubbleProps {
  message: AiMessage;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PACKAGES: Package[] = [
  { label: "Package 1", name: "Shimla-Manali Honeymoon", price: "₹38,500" },
  { label: "Package 2", name: "Dharamshala-Dalhousie Escape", price: "₹41,999" },
  { label: "Package 3", name: "Kasauli-Chail Retreat", price: "₹34,500" },
];

const CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "user",
    text: "Plan a 7-day honeymoon in Himachal under ₹50,000.",
    delay: 600,
  },
  {
    id: 2,
    role: "ai",
    delay: 1800,
    intro: "Found 3 perfect matches for your budget ✨",
    packages: PACKAGES,
    outro: "All include hotel, cab & breakfast. Which one interests you?",
  },
];

const FEATURES: string[] = [
  "Personalized itineraries in under 30 seconds",
  "Budget-aware package recommendations",
  "Real-time availability & expert refinement",
  "Connects directly to our travel team",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white rounded-2xl rounded-bl-sm border border-slate-200 shadow-sm w-fit">
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function AiMessageBubble({ message }: AiMessageBubbleProps) {
  return (
    <div className="bg-white rounded-2xl rounded-bl-sm border border-slate-200 shadow-sm px-4 py-3 max-w-[88%] text-sm text-slate-700 leading-relaxed space-y-2">
      <p>
        Found{" "}
        <span className="font-bold text-rose-500">3 perfect matches</span>{" "}
        for your budget ✨
      </p>
      <div className="space-y-1">
        {message.packages.map((pkg) => (
          <p key={pkg.label}>
            <span className="text-rose-500 font-semibold">→ {pkg.label}:</span>{" "}
            {pkg.name} ({pkg.price})
          </p>
        ))}
      </div>
      <p>{message.outro}</p>
    </div>
  );
}

function FeatureItem({ text, visible, index }: FeatureItemProps) {
  return (
    <li
      className={`flex items-center gap-3 transition-all duration-500 ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"
      }`}
      style={{ transitionDelay: `${300 + index * 100}ms` }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
      <span className="text-slate-400 text-[0.95rem]">{text}</span>
    </li>
  );
}

// ─── Chat Window ─────────────────────────────────────────────────────────────

function ChatWindow() {
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    CHAT_MESSAGES.forEach((msg) => {
      if (msg.role === "ai") {
        const t1 = setTimeout(() => setIsTyping(true), msg.delay - 700);
        const t2 = setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages((prev) => [...prev, msg]);
        }, msg.delay);
        timeouts.push(t1, t2);
      } else {
        const t = setTimeout(() => {
          setVisibleMessages((prev) => [...prev, msg]);
        }, msg.delay);
        timeouts.push(t);
      }
    });

    return () => timeouts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, isTyping]);

  return (
    <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/[0.08] bg-gray-900">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-950 border-b border-white/[0.06]">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          A
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm leading-none mb-1">Avanti AI</p>
          <p className="text-slate-400 text-xs">Dreams Yatri Travel Assistant</p>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      </div>

      {/* Messages */}
      <div className="px-4 py-5 space-y-3 overflow-y-auto min-h-[300px] max-h-[340px] bg-slate-50">
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex animate-[fadeUp_0.35s_ease_forwards] ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "user" ? (
              <div className="bg-gradient-to-br from-red-500 to-red-700 text-white text-sm px-4 py-3 rounded-2xl rounded-br-sm max-w-[80%] leading-relaxed font-medium">
                {msg.text}
              </div>
            ) : (
              <AiMessageBubble message={msg} />
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-[fadeUp_0.3s_ease_forwards]">
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 flex items-center gap-3 bg-slate-100 border-t border-slate-200">
        <input
          type="text"
          value={inputVal}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputVal(e.target.value)}
          placeholder="Tell Avanti your dream trip..."
          className="flex-1 text-sm text-slate-600 placeholder-slate-400 bg-white rounded-full px-4 py-3 outline-none border border-slate-200 focus:border-red-300 transition-colors"
        />
        <button
          type="button"
          aria-label="Send message"
          className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-red-500/30"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export default function AvantiSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-section  bg-linear-to-br bg-neutral-900"
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(239,68,68,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239,68,68,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/4 -translate-y-1/2 size-150 rounded-full bg-red-500/[0.07] blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative screen-space ">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* LEFT COL */}
          <div
            className={`transition-all duration-700 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {/* Tag */}
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 tracking-wide">
                ✦ AI POWERED PLANNING
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-white font-extrabold leading-tight mb-5 text-4xl lg:text-5xl">
              Plan Smarter with{" "}
              <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
                Avanti AI
              </span>
            </h2>

            {/* Subtext */}
            <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-md">
              Tell us your dream. Avanti builds it — instantly, intelligently,
              exactly how you want it.
            </p>

            {/* Features */}
            <ul className="space-y-3.5 mb-10">
              {FEATURES.map((feature, i) => (
                <FeatureItem
                  key={feature}
                  text={feature}
                  visible={visible}
                  index={i}
                />
              ))}
            </ul>

            {/* CTA */}
            <button
              type="button"
              className="inline-flex items-center gap-2.5 text-white font-semibold px-8 py-4 rounded-full text-base bg-gradient-to-r from-red-500 to-red-700 shadow-lg shadow-red-500/30 hover:-translate-y-0.5 hover:shadow-red-500/50 active:scale-95 transition-all duration-200 animate-[glowPulse_3s_ease-in-out_infinite]"
            >
              <ChatIcon />
              Chat With Avanti
            </button>
          </div>

          {/* RIGHT COL */}
          <div
            className={`transition-all duration-700 delay-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <ChatWindow />
          </div>

        </div>
      </div>

    </section>
  );
}