"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw, ChevronLeft } from "lucide-react";
import { Button } from "../../components/ui/button";

export default function HotelDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HotelDetail]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive/60" />
      <div className="space-y-1">
        <p className="font-semibold text-destructive">Failed to load hotel</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message ?? "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hotels">
            <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Hotels
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
