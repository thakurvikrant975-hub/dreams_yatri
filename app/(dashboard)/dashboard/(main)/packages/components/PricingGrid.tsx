"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { savePricingGrid } from "../actions";
import { Loader2, Save } from "lucide-react";

type Duration = { id: number; label: string };
type StayCategory = { id: number; name: string };
type PricingRow = {
  duration_id: number;
  stay_category_id: number;
  meal_rate_cp: number | { toNumber(): number };
  meal_rate_map: number | { toNumber(): number };
  meal_rate_ap: number | { toNumber(): number };
  margin_pct?: number | { toNumber(): number } | null;
  gst_pct?: number | { toNumber(): number } | null;
};

type CellKey = `${number}-${number}`;
type CellValue = { cp: string; map: string; ap: string; margin: string; gst: string };

type Props = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  initialPricing: PricingRow[];
};

function makeKey(durationId: number, categoryId: number): CellKey {
  return `${durationId}-${categoryId}`;
}

function toNum(v: number | { toNumber(): number } | null | undefined): string {
  if (v == null) return "0";
  if (typeof v === "number") return String(v);
  return String(v.toNumber());
}

export function PricingGrid({ packageId, durations, stayCategories, initialPricing }: Props) {
  const [cells, setCells] = useState<Record<CellKey, CellValue>>(() => {
    const map: Record<CellKey, CellValue> = {};
    for (const row of initialPricing) {
      map[makeKey(row.duration_id, row.stay_category_id)] = {
        cp: toNum(row.meal_rate_cp),
        map: toNum(row.meal_rate_map),
        ap: toNum(row.meal_rate_ap),
        margin: toNum(row.margin_pct),
        gst: toNum(row.gst_pct),
      };
    }
    return map;
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const EMPTY_CELL: CellValue = { cp: "0", map: "0", ap: "0", margin: "0", gst: "0" };

  function updateCell(durationId: number, categoryId: number, field: keyof CellValue, value: string) {
    const key = makeKey(durationId, categoryId);
    setCells((prev) => ({
      ...prev,
      [key]: { ...EMPTY_CELL, ...prev[key], [field]: value },
    }));
  }

  type PricingRowInput = { duration_id: number; stay_category_id: number; meal_rate_cp: number; meal_rate_map: number; meal_rate_ap: number; margin_pct: number; gst_pct: number };

  function handleSave() {
    const rows: PricingRowInput[] = [];
    for (const dur of durations) {
      for (const cat of stayCategories) {
        const key = makeKey(dur.id, cat.id);
        const cell = cells[key];
        if (cell && (cell.cp || cell.map || cell.ap)) {
          rows.push({
            duration_id: dur.id,
            stay_category_id: cat.id,
            meal_rate_cp: Number(cell.cp) || 0,
            meal_rate_map: Number(cell.map) || 0,
            meal_rate_ap: Number(cell.ap) || 0,
            margin_pct: Number(cell.margin) || 0,
            gst_pct: Number(cell.gst) || 0,
          });
        }
      }
    }
    startTransition(async () => {
      await savePricingGrid(packageId, rows);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (durations.length === 0 || stayCategories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        Add durations and stay categories first to configure pricing.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="text-left px-3 py-2 font-medium text-muted-foreground border bg-muted/30 min-w-[140px]"
              >
                Duration
              </th>
              {stayCategories.map((cat) => (
                <th key={cat.id} colSpan={5} className="text-center px-3 py-2 font-medium border bg-muted/30">
                  {cat.name}
                </th>
              ))}
            </tr>
            <tr>
              {stayCategories.flatMap((cat) =>
                (["CP (₹)", "MAP (₹)", "AP (₹)", "Margin %", "GST %"] as const).map((h, i) => (
                  <th key={`${cat.id}-${i}`} className="border bg-muted/10 px-2 py-1.5 text-xs text-muted-foreground font-normal min-w-[72px]">
                    {h}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {durations.map((dur) => (
              <tr key={dur.id} className="hover:bg-muted/10">
                <td className="border px-3 py-2 font-medium text-sm">{dur.label}</td>
                {stayCategories.flatMap((cat) => {
                  const key = makeKey(dur.id, cat.id);
                  const cell = cells[key] ?? { cp: "", map: "", ap: "", margin: "0", gst: "0" };
                  return (["cp", "map", "ap", "margin", "gst"] as const).map((field) => (
                    <td key={`${key}-${field}`} className="border px-1.5 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={cell[field]}
                        onChange={(e) => updateCell(dur.id, cat.id, field, e.target.value)}
                        className="h-7 text-sm w-full"
                        placeholder="0"
                      />
                    </td>
                  ));
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        CP = Continental Plan · MAP = Modified American Plan · AP = American Plan
      </p>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
          {saved ? "Saved!" : "Save Pricing"}
        </Button>
      </div>
    </div>
  );
}
