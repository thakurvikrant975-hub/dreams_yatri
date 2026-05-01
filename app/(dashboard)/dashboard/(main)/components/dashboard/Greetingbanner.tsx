// app/dashboard/components/shared/GreetingBanner.tsx
"use client";

import { useEffect, useState } from "react";

interface GreetingBannerProps {
  name: string;
  role?: string | null;
  department?: string | null;
}

function getGreeting(hour: number): { text: string; emoji: string; sub: string } {
  if (hour < 10) {
    return {
      text: "Namaste",
      emoji: "🙏",
      sub: "Office khula ya tumne hi start kiya?"    
    };
  }  if (hour < 11) {
    return {
      text: "Namaste",
      emoji: "🙏",
      sub: "Uncle bringing you chai?",
    };
  }
  if (hour < 12) {
    return {
      text: "Good morning",
      emoji: "☕",
      sub: "Chai in hand?",
    };
  }
  if (hour < 17) {
    return {
      text: "Good afternoon",
      emoji: "☀️",
      sub: "Peak hours. Peak energy. Let's go.",
    };
  }
  if (hour < 21) {
    return {
      text: "Good evening",
      emoji: "🥱",
      sub: "Almost done for the day. Wrap up strong.",
    };
  }
  return {
    text: "Still here?",
    emoji: "🌙",
    sub: "Respect the grind. Don't forget to sleep.",
  };
}

export function GreetingBanner({ name, role, department }: GreetingBannerProps) {
  const [greeting, setGreeting] = useState<ReturnType<typeof getGreeting> | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(getGreeting(hour));
  }, []);

  const firstName = name.split(" ")[0];

  if (!greeting) {
    // SSR-safe skeleton — matches final layout so no layout shift
    return (
      <div className="h-14 rounded-xl bg-muted/40 animate-pulse" />
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting.text}, {firstName}{" "}
          <span role="img" aria-label="greeting">{greeting.emoji}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{greeting.sub}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {role && (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {role}
          </span>
        )}
        {department && (
          <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
            {department}
          </span>
        )}
      </div>
    </div>
  );
}