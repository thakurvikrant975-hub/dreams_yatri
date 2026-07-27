"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "@/app/lib/utils";

const DEFAULT_TAB = "details";
const VALID_TABS = ["details", "rooms", "meals", "pricing", "child-policies", "images"];

export function HotelTabsClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_TAB) params.delete("tab");
    else params.set("tab", value);
    const qs = params.toString();
    // staleTimes.dynamic is intentionally 0 for this route (see next.config.ts),
    // so every tab switch is a real RSC round-trip — wrap it in a transition so
    // there's a visible loading cue instead of a silent stall.
    startTransition(() => {
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    });
  }

  return (
    <div className="relative">
      {isPending && (
        <Loader2
          className="absolute right-0 -top-7 size-4 animate-spin text-dashboard-primary"
          aria-label="Loading tab"
        />
      )}
      <Tabs
        value={activeTab}
        onValueChange={handleValueChange}
        className={cn("transition-opacity duration-150", isPending && "opacity-60 pointer-events-none")}
      >
        {children}
      </Tabs>
    </div>
  );
}
