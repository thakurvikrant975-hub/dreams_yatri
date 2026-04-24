"use client";

import { Info } from "lucide-react";

export function StayCategoriesTab({
  package_id: _package_id,
  stayCategories: _stayCategories,
}: {
  package_id:     number;
  stayCategories: unknown[];
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-5">
      <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Stay categories are now managed automatically via hotel stay types</p>
        <p className="text-xs text-muted-foreground">
          Hotels carry their own stay type (Standard, Deluxe, Luxury, etc.).
          Assign hotels per day directly in the Itinerary tab — no manual stay category setup required.
        </p>
      </div>
    </div>
  );
}
