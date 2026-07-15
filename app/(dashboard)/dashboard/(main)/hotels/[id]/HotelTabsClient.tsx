"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "../../components/ui/tabs";

const DEFAULT_TAB = "details";
const VALID_TABS = ["details", "rooms", "meals", "pricing", "child-policies", "images"];

export function HotelTabsClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_TAB) params.delete("tab");
    else params.set("tab", value);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange}>
      {children}
    </Tabs>
  );
}
