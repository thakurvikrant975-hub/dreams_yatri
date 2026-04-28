"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { SearchSelect } from "../../components/dashboard/SearchSelect";
import { addPackageHotel, removePackageHotel, toggleHotelRecommended, searchHotels } from "../actions";
import { Plus, Trash2, Star, Loader2 } from "lucide-react";

type StayCategory = { id: number; name: string };

type HotelRow = {
  id: number;
  package_id: number;
  hotel_id: number;
  stay_category_id: number;
  is_recommended: boolean;
};

type Props = {
  packageId: number;
  initialHotels: HotelRow[];
  stayCategories: StayCategory[];
};

export function HotelSelector({ packageId, initialHotels, stayCategories }: Props) {
  const [hotels, setHotels] = useState<HotelRow[]>(initialHotels);
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [stayCategoryId, setStayCategoryId] = useState<number | null>(
    stayCategories[0]?.id ?? null
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!hotelId || !stayCategoryId) {
      setError("Select both a hotel and a stay category.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const record = await addPackageHotel({ package_id: packageId, hotel_id: hotelId, stay_category_id: stayCategoryId });
      setHotels((prev) => [...prev, record]);
      setHotelId(null);
    });
  }

  function handleRemove(id: number) {
    startTransition(async () => {
      await removePackageHotel(id, packageId);
      setHotels((prev) => prev.filter((h) => h.id !== id));
    });
  }

  function handleToggleRecommended(id: number, current: boolean) {
    startTransition(async () => {
      await toggleHotelRecommended(id, packageId, !current);
      setHotels((prev) => prev.map((h) => (h.id === id ? { ...h, is_recommended: !current } : h)));
    });
  }

  const categoryMap = Object.fromEntries(stayCategories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-5">
      {/* Add hotel form */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <p className="text-sm font-medium">Add Hotel Assignment</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Hotel</Label>
            <SearchSelect
              value={hotelId}
              onChange={(val) => setHotelId(val)}
              fetchOptions={searchHotels}
              placeholder="Search hotel..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stay Category</Label>
            <select
              value={stayCategoryId ?? ""}
              onChange={(e) => setStayCategoryId(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {stayCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={handleAdd} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
          Add Hotel
        </Button>
      </div>

      {/* Hotels list */}
      {hotels.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No hotels assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {hotels.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Hotel #{h.hotel_id}</span>
                  <Badge variant="outline" className="text-xs">{categoryMap[h.stay_category_id] ?? h.stay_category_id}</Badge>
                  {h.is_recommended && (
                    <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                      <Star className="h-2.5 w-2.5 mr-1" />
                      Recommended
                    </Badge>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleRecommended(h.id, h.is_recommended)}
                className="text-muted-foreground hover:text-amber-500 transition-colors"
                title="Toggle recommended"
              >
                <Star className="h-4 w-4" fill={h.is_recommended ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(h.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
