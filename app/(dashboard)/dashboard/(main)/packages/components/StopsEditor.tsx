"use client";

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export type StopInput = {
  location: string;
  stay_days: number;
  sort_order: number;
};

type Props = {
  value: StopInput[];
  onChange: (stops: StopInput[]) => void;
};

export function StopsEditor({ value, onChange }: Props) {
  const [location, setLocation] = useState("");
  const [stayDays, setStayDays] = useState(1);

  function addStop() {
    if (!location.trim()) return;
    onChange([
      ...value,
      { location: location.trim(), stay_days: stayDays, sort_order: value.length + 1 },
    ]);
    setLocation("");
    setStayDays(1);
  }

  function removeStop(index: number) {
    const updated = value.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i + 1 }));
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((stop, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 font-medium">{stop.location}</span>
              <span className="text-muted-foreground text-xs">{stop.stay_days}N</span>
              <button
                type="button"
                onClick={() => removeStop(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Manali"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStop())}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1 w-20">
          <Label className="text-xs">Nights</Label>
          <Input
            type="number"
            min={0}
            value={stayDays}
            onChange={(e) => setStayDays(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
        <Button type="button" size="sm" onClick={addStop} className="h-8">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No stops added yet. Add at least one stop.
        </p>
      )}
    </div>
  );
}
