"use client";

import { useState, useTransition } from "react";
import { Input }   from "../../../components/ui/input";
import { Badge }   from "../../../components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Loader2, Save, DollarSign } from "lucide-react";
import { Button }        from "../../../components/ui/button";
import { toast }         from "sonner";
import { upsertPricing } from "../../actions";
import type { RouteOption } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type AssignedStayType = {
  id:           number;   // package_stay_type_map.id = stay_map_id
  stay_type_id: number;
  name:         string;
  is_default:   boolean;
};

type PricingRow = {
  stay_map_id:    number;
  route_index:    number;
  price:          number;
  original_price: number | null;
};

type Duration = {
  id:         number;
  label:      string;
  days:       number;
  nights:     number;
  routes:     unknown;
  is_default: boolean;
  pricing:    PricingRow[];
};

// ── Price Cell ────────────────────────────────────────────────────────────

function PriceCell({
  package_id,
  duration_id,
  route_index,
  stay_map_id,
  initial,
}: {
  package_id:  number;
  duration_id: number;
  route_index: number;
  stay_map_id: number;
  initial:     PricingRow | undefined;
}) {
  const [price,    setPrice]    = useState(initial?.price?.toString()          ?? "");
  const [original, setOriginal] = useState(initial?.original_price?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved,    setSaved]    = useState(false);

  const discount = price && original && Number(original) > Number(price)
    ? Math.round((1 - Number(price) / Number(original)) * 100)
    : null;

  function handleSave() {
    if (!price) { toast.error("Enter a price"); return; }
    startTransition(async () => {
      const r = await upsertPricing(
        package_id, duration_id, route_index, stay_map_id,
        Number(price),
        original ? Number(original) : null,
      );
      if (r.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
      else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-1.5 p-3 rounded-lg border bg-background">
      <div className="space-y-1">
        <Input
          type="number" min="0" placeholder="Price ₹" value={price}
          onChange={e => { setPrice(e.target.value); setSaved(false); }}
          className="h-8 text-sm"
        />
        <Input
          type="number" min="0" placeholder="Original ₹" value={original}
          onChange={e => { setOriginal(e.target.value); setSaved(false); }}
          className="h-8 text-sm text-muted-foreground"
        />
      </div>
      <div className="flex items-center justify-between">
        {discount
          ? <span className="text-[10px] font-medium text-green-600">{discount}% off</span>
          : <span />
        }
        <Button
          type="button" size="sm"
          variant={saved ? "default" : "outline"}
          className="h-6 px-2 text-[10px]"
          onClick={handleSave}
          disabled={isPending || !price}
        >
          {isPending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : saved ? "Saved ✓" : <><Save className="h-3 w-3 mr-1" />Save</>
          }
        </Button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function PricingTab({
  package_id,
  durations,
  assignedStayTypes,
}: {
  package_id:        number;
  durations:         Duration[];
  assignedStayTypes: AssignedStayType[];
}) {
  const defaultDuration = durations.find(d => d.is_default) ?? durations[0];
  const [selectedId, setSelectedId] = useState(
    defaultDuration?.id?.toString() ?? ""
  );

  const duration = durations.find(d => d.id === Number(selectedId));
  const routes   = duration ? (duration.routes as RouteOption[]) : [];

  if (durations.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-xl">
        <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Add durations first</p>
      </div>
    );
  }

  if (assignedStayTypes.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-xl">
        <p className="text-sm text-muted-foreground">
          Add stay types in the Stay Types tab first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Duration selector */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium shrink-0">Duration:</p>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            {durations.map(d => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.label}
                {d.is_default && (
                  <span className="text-muted-foreground ml-1 text-xs">(Default)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Set price per person for each Route × Stay Type combination.
        Each cell auto-saves independently.
      </p>

      {duration && routes.map(route => (
        <div key={route.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Route {route.id + 1}{route.is_default ? " (Default)" : ""}
            </Badge>
            <span className="text-xs text-muted-foreground">{route.label}</span>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 w-36">
                    Stay Type
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">
                    Price per person
                  </th>
                </tr>
              </thead>
              <tbody>
                {assignedStayTypes
                  .sort((a, b) => a.is_default ? -1 : 1)
                  .map(stay => {
                    const existing = duration.pricing.find(
                      p => p.stay_map_id === stay.id && p.route_index === route.id
                    );
                    return (
                      <tr key={stay.id} className="border-b last:border-0">
                        <td className="p-3">
                          <p className="text-sm font-medium">{stay.name}</p>
                          {stay.is_default && (
                            <span className="text-[10px] text-muted-foreground">Default</span>
                          )}
                        </td>
                        <td className="p-3">
                          <PriceCell
                            package_id={package_id}
                            duration_id={duration.id}
                            route_index={route.id}
                            stay_map_id={stay.id}
                            initial={existing}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}