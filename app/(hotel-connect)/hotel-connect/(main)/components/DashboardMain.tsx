"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/app/lib/utils";
import { HIDES_MOBILE_BOTTOM_NAV } from "./MobileBottomNav";

// Reserves bottom padding on mobile so page content isn't hidden behind the
// fixed MobileBottomNav — except on routes where that nav doesn't render
// (the property wizard), where the padding would just be dead space.
export default function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bottomNavHidden = HIDES_MOBILE_BOTTOM_NAV.test(pathname);

  return (
    <main
      className={cn(
        "flex-1 flex flex-col overflow-y-auto min-w-0",
        !bottomNavHidden && "pb-16 lg:pb-0",
      )}
    >
      {children}
    </main>
  );
}
