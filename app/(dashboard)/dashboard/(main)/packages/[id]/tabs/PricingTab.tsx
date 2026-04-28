"use client";

import { PricingGrid } from "../../components/PricingGrid";

type Duration = { id: number; label: string };
type StayCategory = { id: number; name: string };
type PricingRow = { duration_id: number; stay_category_id: number; price: number; margin_percentage: number; gst: number };

type Props = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  initialPricing: PricingRow[];
};

export function PricingTab({ packageId, durations, stayCategories, initialPricing }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Pricing</h2>
        <p className="text-sm text-muted-foreground">
          Set price, margin, and GST for each duration × stay category combination.
        </p>
      </div>
      <PricingGrid
        packageId={packageId}
        durations={durations}
        stayCategories={stayCategories}
        initialPricing={initialPricing}
      />
    </div>
  );
}
