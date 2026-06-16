"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "../../components/ui/button";

export default function CabPricingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CabPricing]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive/60" />
      <div className="space-y-1">
        <p className="font-semibold text-destructive">Failed to load cab pricing</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message ?? "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}
