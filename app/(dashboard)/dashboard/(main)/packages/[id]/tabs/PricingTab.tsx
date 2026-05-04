"use client";

import React, { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import { Loader2, Save, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { bulkSetPricingAction } from "@/app/actions/packages/pricing.actions";
import type { PackageDuration, PackageStayCategory, PackagePricing } from "@/app/types/packages";

type Props = {
  packageId: number;
  durations: PackageDuration[];
  categories: PackageStayCategory[];
  pricings: (PackagePricing & { margin_percentage: number; gst_percentage: number })[];
};

type CellKey = `${number}_${number}`;

type CellValue = {
  margin_percentage: string;
  gst_percentage: string;
};

function makeKey(durationId: number, categoryId: number): CellKey {
  return `${durationId}_${categoryId}`;
}

export function PricingTab({ packageId, durations, categories, pricings }: Props) {
  const [isPending, startTransition] = useTransition();

  // Initialize grid from existing pricings
  const initCell = (): Record<CellKey, CellValue> => {
    const map: Record<CellKey, CellValue> = {} as Record<CellKey, CellValue>;
    for (const d of durations) {
      for (const c of categories) {
        const key = makeKey(d.id, c.id);
        const existing = pricings.find(
          p => p.duration_id === d.id && p.stay_category_id === c.id
        );
        map[key] = {
          margin_percentage: existing ? String(existing.margin_percentage) : "15",
          gst_percentage: existing ? String(existing.gst_percentage) : "5",
        };
      }
    }
    return map;
  };

  const [cells, setCells] = useState<Record<CellKey, CellValue>>(initCell);

  function updateCell(key: CellKey, field: keyof CellValue, val: string) {
    setCells(c => ({ ...c, [key]: { ...c[key], [field]: val } }));
  }

  function handleBulkSave() {
    const entries: { duration_id: number; stay_category_id: number; margin_percentage: number; gst_percentage: number }[] = [];

    for (const d of durations) {
      for (const c of categories) {
        const key = makeKey(d.id, c.id);
        const cell = cells[key];
        const margin = parseFloat(cell.margin_percentage);
        const gst = parseFloat(cell.gst_percentage);

        if (isNaN(margin) || margin < 0 || margin > 100) {
          return toast.error(`Invalid margin for ${d.label} × ${c.label}`);
        }
        if (isNaN(gst) || gst < 0 || gst > 100) {
          return toast.error(`Invalid GST for ${d.label} × ${c.label}`);
        }

        entries.push({
          duration_id: d.id,
          stay_category_id: c.id,
          margin_percentage: margin,
          gst_percentage: gst,
        });
      }
    }

    if (entries.length === 0) return toast.error("No entries to save");

    startTransition(async () => {
      const res = await bulkSetPricingAction({
        package_id: packageId,
        entries,
      });
      if (res.success) toast.success("Pricing saved");
      else toast.error(res.error);
    });
  }

  if (durations.length === 0 || categories.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            {durations.length === 0 ? "No durations defined" : "No stay categories defined"}
          </p>
          <p className="text-xs text-muted-foreground">
            {durations.length === 0
              ? "Add durations in the Basic tab first"
              : "Add stay categories in the Hotels tab first"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Margin & GST Configuration</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Set margin% and GST% for each duration × stay category combination.
                Prices are always computed live from the itinerary — these are the only stored values.
              </p>
            </div>
            <Button onClick={handleBulkSave} disabled={isPending} size="sm">
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[160px]">Duration</TableHead>
                  {categories.map(cat => (
                    <TableHead key={cat.id} colSpan={2} className="text-center border-l">
                      {cat.label}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30 text-xs">
                  <TableHead />
                  {categories.map(cat => (
                    <React.Fragment key={cat.id}>
                      <TableHead className="border-l text-xs text-muted-foreground">Margin %</TableHead>
                      <TableHead className="text-xs text-muted-foreground">GST %</TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {durations.map(dur => (
                  <TableRow key={dur.id}>
                    <TableCell className="font-medium text-sm">
                      {dur.label}
                      <div className="text-xs text-muted-foreground">{dur.days}D / {dur.nights}N</div>
                    </TableCell>
                    {categories.map(cat => {
                      const key = makeKey(dur.id, cat.id);
                      const cell = cells[key] ?? { margin_percentage: "15", gst_percentage: "5" };
                      return (
                        <>
                          <TableCell key={`${key}-margin`} className="border-l p-1.5">
                            <Input
                              type="number"
                              min={0} max={100} step={0.5}
                              value={cell.margin_percentage}
                              onChange={e => updateCell(key, "margin_percentage", e.target.value)}
                              className="h-7 text-sm w-20"
                            />
                          </TableCell>
                          <TableCell key={`${key}-gst`} className="p-1.5">
                            <Input
                              type="number"
                              min={0} max={100} step={0.5}
                              value={cell.gst_percentage}
                              onChange={e => updateCell(key, "gst_percentage", e.target.value)}
                              className="h-7 text-sm w-20"
                            />
                          </TableCell>
                        </>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
        <p className="font-medium text-sm">How pricing is calculated</p>
        <p className="text-xs text-muted-foreground">
          Base cost = sum of hotel room nights + mandatory activity prices (from itinerary)
        </p>
        <p className="text-xs text-muted-foreground">
          Final price = Base × (1 + Margin%) × (1 + GST%)
        </p>
        <p className="text-xs text-muted-foreground">
          No price amounts are stored — everything is computed live.
        </p>
      </div>
    </div>
  );
}
