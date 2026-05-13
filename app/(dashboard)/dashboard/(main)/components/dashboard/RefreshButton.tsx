// components/dashboard/RefreshButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/app/lib/utils";

export function RefreshButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            variant="outline"
            size="lg"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="gap-2 bg-dashboard-base-300 border text-dashboard-base-content border-dashboard-base-content/20 hover:bg-dashboard-base-content/15 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm"
        >
            <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
            {isPending ? "Refreshing..." : "Refresh"}
        </Button>
    );
}