"use client";

import { useState, useTransition } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Loader2, Check, Percent, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { handleUpsertPackagePricing } from "@/app/actions/packages/pricing.actions";

// ── Types ──────────────────────────────────────────────────────────────────

type Duration = { id: number; label: string; days: number; nights: number };
type StayCategory = { id: number; label: string; slug: string };
type SavedPricing = {
  id: number;
  duration_id: number;
  stay_category_id: number;
  margin_percentage: number;
  gst_percentage: number;
};

type PricingTabProps = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  initialPricings: SavedPricing[];
};

// ── Per-row component ──────────────────────────────────────────────────────

function PricingRow({
  packageId,
  durationId,
  stayCategory,
  initialMargin,
  initialGst,
  hasConfig,
}: {
  packageId: number;
  durationId: number;
  stayCategory: StayCategory;
  initialMargin: number;
  initialGst: number;
  hasConfig: boolean;
}) {
  const [margin, setMargin] = useState(String(initialMargin));
  const [gst, setGst] = useState(String(initialGst));
  const [saved, setSaved] = useState(hasConfig);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const m = parseFloat(margin);
    const g = parseFloat(gst);
    if (isNaN(m) || isNaN(g) || m < 0 || g < 0) {
      toast.error("Enter valid non-negative percentages");
      return;
    }
    startTransition(async () => {
      const result = await handleUpsertPackagePricing({
        package_id: packageId,
        duration_id: durationId,
        stay_category_id: stayCategory.id,
        margin_percentage: m,
        gst_percentage: g,
      });
      if (result.success) {
        setSaved(true);
        toast.success(`${stayCategory.label} pricing saved`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="w-36 min-w-0 shrink-0">
        <span className="text-sm font-medium truncate block">{stayCategory.label}</span>
        {!hasConfig && !saved && (
          <span className="text-[10px] text-amber-500 font-medium">Not configured</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1">
        {/* Margin */}
        <div className="relative w-28">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={margin}
            onChange={(e) => { setMargin(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8"
            placeholder="10"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        <span className="text-xs text-muted-foreground">+</span>

        {/* GST */}
        <div className="relative w-28">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={gst}
            onChange={(e) => { setGst(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8"
            placeholder="5"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        <span className="text-xs text-muted-foreground hidden sm:block">GST</span>

        {/* Save */}
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={handleSave}
          disabled={isPending || saved}
          className="h-8 w-20 shrink-0"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PricingTab({
  packageId,
  durations,
  stayCategories,
  initialPricings,
}: PricingTabProps) {
  if (durations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No durations found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add durations in the Route Builder tab first.
        </p>
      </div>
    );
  }

  if (stayCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No stay categories found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add stay categories in the Itinerary Builder tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Margin &amp; GST Configuration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Set the margin percentage and GST rate for each duration &amp; stay category
          combination. These are applied on top of the raw itinerary cost.
        </p>
      </div>

      {/* Column labels */}
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span className="w-36 shrink-0">Stay Category</span>
        <div className="flex items-center gap-2 flex-1">
          <span className="w-28 text-center">Margin %</span>
          <span className="w-5" />
          <span className="w-28 text-center">GST %</span>
        </div>
      </div>

      {durations.map((duration) => (
        <Card key={duration.id}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{duration.label}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {duration.nights}N / {duration.days}D
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-1">
            {stayCategories.map((cat) => {
              const existing = initialPricings.find(
                (p) => p.duration_id === duration.id && p.stay_category_id === cat.id
              );
              return (
                <PricingRow
                  key={`${duration.id}-${cat.id}`}
                  packageId={packageId}
                  durationId={duration.id}
                  stayCategory={cat}
                  initialMargin={existing?.margin_percentage ?? 10}
                  initialGst={existing?.gst_percentage ?? 5}
                  hasConfig={!!existing}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
