"use client";

import { HotelSelector } from "../../components/HotelSelector";

type StayCategory = { id: number; name: string };
type HotelRow = { id: number; package_id: number; hotel_id: number; stay_category_id: number; is_recommended: boolean };

type Props = {
  packageId: number;
  initialHotels: HotelRow[];
  stayCategories: StayCategory[];
};

export function HotelsTab({ packageId, initialHotels, stayCategories }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Hotel Assignments</h2>
        <p className="text-sm text-muted-foreground">Assign hotels per stay category for this package.</p>
      </div>
      <HotelSelector
        packageId={packageId}
        initialHotels={initialHotels}
        stayCategories={stayCategories}
      />
    </div>
  );
}
