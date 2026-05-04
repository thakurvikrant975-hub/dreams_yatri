"use client";

import React, { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import { Loader2, Save, Calculator, DollarSign, BedDouble, Activity, Car } from "lucide-react";
import { toast } from "sonner";
import { bulkSetPricingAction } from "@/app/actions/packages/pricing.actions";
import { calculatePriceAction } from "@/app/actions/packages/pricing.actions";
import type {
  PackageDuration,
  PackageStayCategory,
  PackagePricing,
  RouteWithStops,
  PackagePriceBreakdown,
} from "@/app/types/packages";

type Props = {
  packageId: number;
  durations: PackageDuration[];
  categories: PackageStayCategory[];
  routes: RouteWithStops[];
  pricings: (PackagePricing & { margin_percentage: number; gst_percentage: number })[];
};

type CellKey = `${number}_${number}`;
type CellValue = { margin_percentage: string; gst_percentage: string };

function makeKey(durationId: number, categoryId: number): CellKey {
  return `${durationId}_${categoryId}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function PricingPreviewTab({ packageId, durations, categories, routes, pricings }: Props) {
  // ── Margin / GST grid ─────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();

  const initCells = (): Record<CellKey, CellValue> => {
    const map = {} as Record<CellKey, CellValue>;
    for (const d of durations) {
      for (const c of categories) {
        const key = makeKey(d.id, c.id);
        const existing = pricings.find(p => p.duration_id === d.id && p.stay_category_id === c.id);
        map[key] = {
          margin_percentage: existing ? String(existing.margin_percentage) : "15",
          gst_percentage: existing ? String(existing.gst_percentage) : "5",
        };
      }
    }
    return map;
  };

  const [cells, setCells] = useState<Record<CellKey, CellValue>>(initCells);

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
        if (isNaN(margin) || margin < 0 || margin > 100)
          return toast.error(`Invalid margin for ${d.label} × ${c.label}`);
        if (isNaN(gst) || gst < 0 || gst > 100)
          return toast.error(`Invalid GST for ${d.label} × ${c.label}`);
        entries.push({ duration_id: d.id, stay_category_id: c.id, margin_percentage: margin, gst_percentage: gst });
      }
    }
    if (entries.length === 0) return toast.error("No entries to save");
    startTransition(async () => {
      const res = await bulkSetPricingAction({ package_id: packageId, entries });
      if (res.success) toast.success("Pricing configuration saved");
      else toast.error(res.error);
    });
  }

  // ── Live calculator ───────────────────────────────────────────────────────────
  const [calcDuration, setCalcDuration] = useState(durations[0]?.id ? String(durations[0].id) : "");
  const [calcCategory, setCalcCategory] = useState(categories[0]?.id ? String(categories[0].id) : "");
  const [calcRoute, setCalcRoute] = useState("");
  const [calcPax, setCalcPax] = useState("2");
  const [breakdown, setBreakdown] = useState<PackagePriceBreakdown | null>(null);
  const [isCalcPending, startCalcTransition] = useTransition();

  const filteredRoutes = routes.filter(r => String(r.duration_id) === calcDuration);

  function handleCalculate() {
    if (!calcDuration || !calcCategory || !calcRoute) {
      return toast.error("Select duration, category and route");
    }
    const pax = parseInt(calcPax);
    if (isNaN(pax) || pax < 1) return toast.error("Invalid pax count");

    startCalcTransition(async () => {
      const res = await calculatePriceAction({
        package_id: packageId,
        duration_id: parseInt(calcDuration),
        stay_category_id: parseInt(calcCategory),
        pax,
      });
      if (res.success) setBreakdown(res.data);
      else toast.error(res.error);
    });
  }

  const hasGrid = durations.length > 0 && categories.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Margin / GST configuration ─────────────────────────────── */}
      {!hasGrid ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {durations.length === 0 ? "No durations defined" : "No stay categories defined"}
            </p>
            <p className="text-xs text-muted-foreground">
              {durations.length === 0 ? "Add durations in the Basic tab first" : "Add stay categories in the Hotels tab first"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Margin & GST Configuration</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Set margin% and GST% per duration × stay category. Prices are computed live from itinerary.
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
                            <TableCell key={`${key}-m`} className="border-l p-1.5">
                              <Input
                                type="number" min={0} max={100} step={0.5}
                                value={cell.margin_percentage}
                                onChange={e => updateCell(key, "margin_percentage", e.target.value)}
                                className="h-7 text-sm w-20"
                              />
                            </TableCell>
                            <TableCell key={`${key}-g`} className="p-1.5">
                              <Input
                                type="number" min={0} max={100} step={0.5}
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
      )}

      {/* ── Live price calculator ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Live Price Calculator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Preview the final price for a specific booking configuration.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <Select
                value={calcDuration}
                onValueChange={v => { setCalcDuration(v); setCalcRoute(""); setBreakdown(null); }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {durations.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Stay Category</Label>
              <Select value={calcCategory} onValueChange={v => { setCalcCategory(v); setBreakdown(null); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Route</Label>
              <Select
                value={calcRoute}
                onValueChange={v => { setCalcRoute(v); setBreakdown(null); }}
                disabled={filteredRoutes.length === 0}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={filteredRoutes.length === 0 ? "No routes" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredRoutes.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Pax</Label>
              <Input
                type="number" min={1} max={50}
                value={calcPax}
                onChange={e => { setCalcPax(e.target.value); setBreakdown(null); }}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={isCalcPending || !calcDuration || !calcCategory || !calcRoute}
            size="sm"
          >
            {isCalcPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Calculate Price
          </Button>

          {breakdown && (
            <div className="rounded-lg border bg-muted/20 divide-y">
              {/* Stay lines */}
              {breakdown.stay_lines.length > 0 && (
                <div className="p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" /> Accommodation
                  </p>
                  {breakdown.stay_lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Day {line.day} · {line.hotel_name}{line.room_name ? ` (${line.room_name})` : ""} × {line.nights}N
                      </span>
                      <span>{fmt(line.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Activity lines */}
              {breakdown.activity_lines.filter(l => !l.is_optional).length > 0 && (
                <div className="p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> Activities (mandatory)
                  </p>
                  {breakdown.activity_lines.filter(l => !l.is_optional).map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Day {line.day} · {line.activity_name} × {line.pax} pax
                      </span>
                      <span>{fmt(line.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Transfer lines */}
              {breakdown.transfer_lines.length > 0 && (
                <div className="p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" /> Transfers
                  </p>
                  {breakdown.transfer_lines.map((line, i) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      Day {line.day} · {line.pickup_point && line.drop_point
                        ? `${line.pickup_point} → ${line.drop_point}`
                        : line.cab_type ?? "Transfer"}
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Cost</span>
                  <span>{fmt(breakdown.base_cost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Margin ({breakdown.margin_percentage}%)
                  </span>
                  <span>{fmt(breakdown.margin_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    GST ({breakdown.gst_percentage}%)
                  </span>
                  <span>{fmt(breakdown.gst_amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Final Price</span>
                  <span className="text-lg text-primary">{fmt(breakdown.final_price)}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {parseInt(calcPax)} pax
                  </Badge>
                  {durations.find(d => String(d.id) === calcDuration) && (
                    <Badge variant="outline" className="text-xs">
                      {durations.find(d => String(d.id) === calcDuration)!.label}
                    </Badge>
                  )}
                  {categories.find(c => String(c.id) === calcCategory) && (
                    <Badge variant="outline" className="text-xs">
                      {categories.find(c => String(c.id) === calcCategory)!.label}
                    </Badge>
                  )}
                </div>
                {breakdown.activity_lines.some(l => l.is_optional) && (
                  <p className="text-xs text-muted-foreground">
                    * Optional activities not included in price
                  </p>
                )}
              </div>
            </div>
          )}

          {!breakdown && !isCalcPending && (
            <p className="text-xs text-muted-foreground">
              Select a configuration above and click Calculate to see the live price breakdown.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
