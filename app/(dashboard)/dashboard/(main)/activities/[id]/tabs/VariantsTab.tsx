"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
    Plus, Pencil, Trash2, Loader2, Check, X,
    ChevronDown, ChevronRight, Zap, Calendar, AlertTriangle,
    CalendarDays, Info,
} from "lucide-react";
import {
    PricingRangeCalendarPicker,
    type DateRange,
    type SeasonRange,
} from "../../../components/ui/pricing-range-calendar";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
    createVariantWithSeasons, updateVariantWithSeasons, deleteVariant,
    upsertVariantPricing, deleteVariantPricing,
    type ActivityVariant, type ActivityVariantPricing,
    type ActivitySeasonInput,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type PricingFormState = {
    label:             string;
    age_from:          string;
    age_to:            string;
    price:             string;
    original_price:    string;
    margin_percentage: string;
    is_active:         boolean;
};

/** Local season entry — not yet saved to DB */
type ActivitySeasonEntry = {
    tempId:     string;
    valid_from: string;
    valid_to:   string;
    price:      string;
    is_active:  boolean;
};

type VariantFormState = {
    name:           string;
    booking_mode:   string;
    pricing_type:   string;
    min_persons:    string;
    max_persons:    string;
    cost_price:     string;
    gst_percentage: string;
    is_active:      boolean;
    seasons:        ActivitySeasonEntry[];
};

// ── Constants ─────────────────────────────────────────────────────────────

const BOOKING_MODES = [
    { value: "PRIVATE", label: "Private",  description: "Exclusive group, no mixing" },
    { value: "GROUP",   label: "Group",    description: "Fixed group departure" },
    { value: "SHARED",  label: "Shared",   description: "Shared with others" },
];

const PRICING_TYPES = [
    { value: "PER_PERSON",  label: "Per Person" },
    { value: "FLAT_RATE",   label: "Flat Rate" },
    { value: "PER_VEHICLE", label: "Per Vehicle" },
];

const EMPTY_VARIANT_FORM: VariantFormState = {
    name: "", booking_mode: "", pricing_type: "",
    min_persons: "", max_persons: "", cost_price: "",
    gst_percentage: "5", is_active: true, seasons: [],
};

const EMPTY_SEASON: Omit<ActivitySeasonEntry, "tempId"> = {
    valid_from: "", valid_to: "", price: "", is_active: true,
};

const EMPTY_PRICING: PricingFormState = {
    label: "", age_from: "", age_to: "", price: "",
    original_price: "", margin_percentage: "0", is_active: true,
};

const DEFAULT_LABELS = ["Adult", "Child", "Infant", "Senior"];

// ── Helpers ───────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function toISODate(val: Date | string | null | undefined): string {
    if (!val) return "";
    const d = typeof val === "string" ? new Date(val) : val;
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

// ── Date helpers (year-agnostic: all seasons stored as 2000-MM-DD) ────────

function toDateObj(str: string): Date | undefined {
    if (!str) return undefined;
    const normalized = "2000" + str.slice(4);
    const d = new Date(normalized + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
}

function fromDateObj(d: Date | undefined): string {
    if (!d) return "";
    const m   = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `2000-${m}-${day}`;
}

function fmtMonthDay(dateStr: string): string {
    const d = toDateObj(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function overlappingIds(seasons: ActivitySeasonEntry[]): Set<string> {
    const withDates = seasons.filter(s => s.valid_from && s.valid_to);
    const out = new Set<string>();
    for (let i = 0; i < withDates.length; i++) {
        for (let j = i + 1; j < withDates.length; j++) {
            const a = withDates[i], b = withDates[j];
            if (a.valid_from <= b.valid_to && b.valid_from <= a.valid_to) {
                out.add(a.tempId);
                out.add(b.tempId);
            }
        }
    }
    return out;
}

function toVariantFormState(v: ActivityVariant): VariantFormState {
    return {
        name:           v.name,
        booking_mode:   v.booking_mode,
        pricing_type:   v.pricing_type,
        min_persons:    v.min_persons != null ? String(v.min_persons) : "",
        max_persons:    v.max_persons != null ? String(v.max_persons) : "",
        cost_price:     v.cost_price  != null ? String(v.cost_price)  : "",
        gst_percentage: String(v.gst_percentage),
        is_active:      v.is_active,
        seasons:        (v.seasons ?? []).map(s => ({
            tempId:     uid(),
            valid_from: toISODate(s.valid_from),
            valid_to:   toISODate(s.valid_to),
            price:      s.pricing.length > 0 ? String(s.pricing[0].price) : "",
            is_active:  s.is_active,
        })),
    };
}

// ── PricingRowForm ────────────────────────────────────────────────────────

function PricingRowForm({
    form, onChange, onSave, onCancel, isSaving, suggestedLabels,
}: {
    form: PricingFormState;
    onChange: (f: PricingFormState) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
    suggestedLabels?: string[];
}) {
    function upd<K extends keyof PricingFormState>(k: K, v: PricingFormState[K]) {
        onChange({ ...form, [k]: v });
    }
    return (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                    <Label className="text-[11px]">Label <span className="text-destructive">*</span></Label>
                    {suggestedLabels && suggestedLabels.length > 0 ? (
                        <Select value={form.label} onValueChange={v => upd("label", v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                                {suggestedLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                <SelectItem value="__custom">Custom…</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input className="h-7 text-xs" placeholder="Adult" value={form.label}
                            onChange={e => upd("label", e.target.value)} autoFocus />
                    )}
                    {form.label === "__custom" && (
                        <Input className="h-7 text-xs mt-1" placeholder="Custom label" autoFocus
                            onChange={e => upd("label", e.target.value)} />
                    )}
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px]">Price (₹) <span className="text-destructive">*</span></Label>
                    <Input className="h-7 text-xs" type="number" min={0} placeholder="2500"
                        value={form.price} onChange={e => upd("price", e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px]">MRP (₹)</Label>
                    <Input className="h-7 text-xs" type="number" min={0} placeholder="3000"
                        value={form.original_price} onChange={e => upd("original_price", e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px]">Margin %</Label>
                    <Input className="h-7 text-xs" type="number" min={0} max={100} placeholder="0"
                        value={form.margin_percentage} onChange={e => upd("margin_percentage", e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-[11px]">Age From (yrs)</Label>
                    <Input className="h-7 text-xs" type="number" min={0} placeholder="Optional"
                        value={form.age_from} onChange={e => upd("age_from", e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px]">Age To (yrs)</Label>
                    <Input className="h-7 text-xs" type="number" min={0} placeholder="Optional"
                        value={form.age_to} onChange={e => upd("age_to", e.target.value)} />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={v => upd("is_active", v)} className="scale-75" />
                    <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <div className="flex gap-1.5">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={onCancel} disabled={isSaving}>
                        <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button type="button" size="sm" className="h-7 text-xs" onClick={onSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Seasons Inline List (inside VariantForm) ──────────────────────────────

function SeasonsInlineList({
    seasons, onChange, costPrice = 0,
}: {
    seasons:   ActivitySeasonEntry[];
    onChange:  (s: ActivitySeasonEntry[]) => void;
    costPrice?: number;
}) {
    const overlapping = overlappingIds(seasons);

    function addSeason() {
        onChange([...seasons, { ...EMPTY_SEASON, tempId: uid() }]);
    }

    function updateSeason(tempId: string, patch: Partial<Omit<ActivitySeasonEntry, "tempId">>) {
        onChange(seasons.map(s => s.tempId === tempId ? { ...s, ...patch } : s));
    }

    function removeSeason(tempId: string) {
        onChange(seasons.filter(s => s.tempId !== tempId));
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Seasonal Pricing
                    <span className="font-normal normal-case text-muted-foreground/60">— required, at least 1</span>
                </p>
                {seasons.length === 0 && (
                    <span className="text-[10px] text-destructive">Add at least one season to save</span>
                )}
            </div>

            {seasons.length > 0 && (
                overlapping.size > 0 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                        <p className="text-xs text-destructive">
                            <span className="font-semibold">Overlapping seasons detected.</span>{" "}
                            Date ranges must not overlap — fix the highlighted seasons before saving.
                        </p>
                    </div>
                ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
                        <p className="text-xs text-blue-700">
                            Click a start date then an end date to set the season range.
                            <span className="font-semibold"> {seasons.length} season{seasons.length !== 1 ? "s" : ""} configured.</span>
                        </p>
                    </div>
                )
            )}

            {seasons.map(s => {
                const hasOverlap  = overlapping.has(s.tempId);
                const rangeValue: DateRange = {
                    from: toDateObj(s.valid_from),
                    to:   toDateObj(s.valid_to),
                };
                const calendarSeasons: SeasonRange[] = seasons
                    .filter(x => x.valid_from && x.valid_to && Number(x.price) > 0)
                    .map(x => ({
                        from:         x.valid_from.slice(5),
                        to:           x.valid_to.slice(5),
                        weekdayPrice: Number(x.price),
                    }));
                const rangeLabel = s.valid_from && s.valid_to
                    ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`
                    : s.valid_from ? `From ${fmtMonthDay(s.valid_from)}` : "No dates selected";
                const priceInvalid = s.price !== "" && (isNaN(Number(s.price)) || Number(s.price) <= 0);

                return (
                    <div
                        key={s.tempId}
                        className={cn(
                            "rounded-xl border p-4 space-y-3",
                            hasOverlap ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/10",
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className={cn(
                                    "text-xs font-medium truncate",
                                    s.valid_from ? "text-foreground" : "text-muted-foreground",
                                )}>
                                    {rangeLabel}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeSeason(s.tempId)}
                                className="text-destructive/60 hover:text-destructive transition-colors cursor-pointer shrink-0"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {hasOverlap && (
                            <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Date range overlaps with another season — fix before saving.
                            </div>
                        )}

                        {/* Price */}
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Price *</Label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                                <Input
                                    type="number" min={0} step={100}
                                    placeholder="0"
                                    value={s.price}
                                    onChange={e => updateSeason(s.tempId, { price: e.target.value })}
                                    className={cn("h-8 pl-6 text-sm", priceInvalid && "border-destructive")}
                                />
                            </div>
                        </div>

                        {/* Calendar picker */}
                        <PricingRangeCalendarPicker
                            value={rangeValue}
                            onChange={range => updateSeason(s.tempId, {
                                valid_from: fromDateObj(range?.from),
                                valid_to:   fromDateObj(range?.to),
                            })}
                            seasons={calendarSeasons}
                            basePrice={costPrice}
                            placeholder="Select season date range"
                            error={hasOverlap}
                        />
                    </div>
                );
            })}

            <Button
                type="button" variant="outline"
                className="w-full h-8 text-xs gap-1.5 border-dashed bg-muted/20 hover:bg-muted/40 rounded-md cursor-pointer"
                onClick={addSeason}
            >
                <Plus className="h-3.5 w-3.5" />
                Add Season
            </Button>
        </div>
    );
}

// ── Variant Form ──────────────────────────────────────────────────────────

function VariantForm({
    initial, onSave, onCancel, isSaving,
}: {
    initial:  VariantFormState;
    onSave:   (form: VariantFormState) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [form, setForm] = useState<VariantFormState>(initial);
    function upd<K extends keyof VariantFormState>(k: K, v: VariantFormState[K]) {
        setForm(prev => ({ ...prev, [k]: v }));
    }

    const seasonOverlaps = overlappingIds(form.seasons);
    const isValid =
        !!form.name && !!form.booking_mode && !!form.pricing_type &&
        form.seasons.length > 0 &&
        seasonOverlaps.size === 0 &&
        form.seasons.every(s => !!s.valid_from && !!s.valid_to && !!s.price && Number(s.price) > 0);

    return (
        <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
            {/* Row 1: Name + Booking Mode + Pricing Type */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label>Variant Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. Private Rafting (6 pax)"
                        value={form.name} onChange={e => upd("name", e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                    <Label>Booking Mode <span className="text-destructive">*</span></Label>
                    <Select value={form.booking_mode} onValueChange={v => upd("booking_mode", v)}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                            {BOOKING_MODES.map(m => (
                                <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                    <span className="text-xs text-muted-foreground ml-1">— {m.description}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Pricing Type <span className="text-destructive">*</span></Label>
                    <Select value={form.pricing_type} onValueChange={v => upd("pricing_type", v)}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                            {PRICING_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Row 2: Min/Max Persons + Cost Price + GST */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                    <Label>Min Persons</Label>
                    <Input type="number" min={1} placeholder="1"
                        value={form.min_persons} onChange={e => upd("min_persons", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Max Persons</Label>
                    <Input type="number" min={1} placeholder="20"
                        value={form.max_persons} onChange={e => upd("max_persons", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Cost Price (₹)</Label>
                    <Input type="number" min={0} placeholder="1200"
                        value={form.cost_price} onChange={e => upd("cost_price", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>GST %</Label>
                    <Input type="number" min={0} max={28} placeholder="5"
                        value={form.gst_percentage} onChange={e => upd("gst_percentage", e.target.value)} />
                </div>
            </div>

            {/* Seasons inline */}
            <div className="border-t pt-3">
                <SeasonsInlineList
                    seasons={form.seasons}
                    onChange={s => upd("seasons", s)}
                    costPrice={Number(form.cost_price) || 0}
                />
            </div>

            {/* Footer */}
            <div className="space-y-2 pt-1">
                {seasonOverlaps.size > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Overlapping season date ranges — fix the highlighted seasons before saving.
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Switch checked={form.is_active} onCheckedChange={v => upd("is_active", v)} />
                        <span className="text-sm text-muted-foreground">Active</span>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                        </Button>
                        <Button type="button" size="sm" disabled={!isValid || isSaving}
                            onClick={() => onSave(form)}>
                            {isSaving
                                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
                                : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Variant</>
                            }
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Default Pricing Panel (fallback, shown in expanded view) ──────────────

function PricingPanel({
    variant, activityId, onUpdated,
}: {
    variant:    ActivityVariant;
    activityId: number;
    onUpdated:  (variantId: number, pricing: ActivityVariantPricing[]) => void;
}) {
    const [saving, setSaving]     = useState<number | "new" | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [editId, setEditId]     = useState<number | null>(null);
    const [editForm, setEditForm] = useState<PricingFormState>(EMPTY_PRICING);
    const [addForm, setAddForm]   = useState<PricingFormState>(EMPTY_PRICING);
    const [showAdd, setShowAdd]   = useState(false);

    async function handleSave(form: PricingFormState, existingId?: number) {
        const price = Number(form.price);
        if (!form.label || !price || price <= 0) { toast.error("Label and valid price are required"); return; }
        setSaving(existingId ?? "new");
        const res = await upsertVariantPricing(variant.id, activityId, {
            id: existingId,
            label:             form.label,
            age_from:          form.age_from ? Number(form.age_from) : null,
            age_to:            form.age_to   ? Number(form.age_to)   : null,
            price,
            original_price:    form.original_price ? Number(form.original_price) : null,
            margin_percentage: Number(form.margin_percentage) || 0,
            is_active:         form.is_active,
        });
        setSaving(null);
        if (!res.success) { toast.error(res.message); return; }
        toast.success(res.message);
        if (existingId) {
            onUpdated(variant.id, variant.pricing.map(p =>
                p.id === existingId ? {
                    ...p, label: form.label,
                    age_from: form.age_from ? Number(form.age_from) : null,
                    age_to:   form.age_to   ? Number(form.age_to)   : null,
                    price, original_price: form.original_price ? Number(form.original_price) : null,
                    margin_percentage: Number(form.margin_percentage) || 0, is_active: form.is_active,
                } : p
            ));
            setEditId(null);
        } else {
            onUpdated(variant.id, [
                ...variant.pricing,
                {
                    id: Date.now(), variant_id: variant.id, label: form.label,
                    age_from: form.age_from ? Number(form.age_from) : null,
                    age_to:   form.age_to   ? Number(form.age_to)   : null,
                    price, original_price: form.original_price ? Number(form.original_price) : null,
                    margin_percentage: Number(form.margin_percentage) || 0,
                    is_active: form.is_active, sort_order: variant.pricing.length,
                },
            ]);
            setAddForm(EMPTY_PRICING);
            setShowAdd(false);
        }
    }

    async function handleDelete(id: number) {
        setDeleting(id);
        const res = await deleteVariantPricing(id, activityId);
        setDeleting(null);
        if (!res.success) { toast.error(res.message); return; }
        onUpdated(variant.id, variant.pricing.filter(p => p.id !== id));
        toast.success(res.message);
    }

    function startEdit(p: ActivityVariantPricing) {
        setEditId(p.id);
        setEditForm({
            label: p.label,
            age_from: p.age_from != null ? String(p.age_from) : "",
            age_to:   p.age_to   != null ? String(p.age_to)   : "",
            price: String(p.price),
            original_price: p.original_price ? String(p.original_price) : "",
            margin_percentage: String(p.margin_percentage),
            is_active: p.is_active,
        });
    }

    return (
        <div className="px-4 pb-4 pt-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Default Pricing{" "}
                <span className="font-normal normal-case text-muted-foreground/60">— used when no season matches</span>
            </p>

            {variant.pricing.map(p => (
                editId === p.id ? (
                    <PricingRowForm key={p.id} form={editForm} onChange={setEditForm}
                        onSave={() => handleSave(editForm, p.id)} onCancel={() => setEditId(null)}
                        isSaving={saving === p.id} />
                ) : (
                    <div key={p.id} className={cn("flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-1.5", !p.is_active && "opacity-50")}>
                        <span className="text-xs font-medium w-20 shrink-0">{p.label}</span>
                        {(p.age_from != null || p.age_to != null) && (
                            <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                                {p.age_from ?? 0}–{p.age_to ?? "∞"} yrs
                            </span>
                        )}
                        <span className="text-sm font-semibold flex-1">₹{p.price.toLocaleString()}</span>
                        {p.original_price && (
                            <span className="text-xs text-muted-foreground line-through">₹{p.original_price.toLocaleString()}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">{p.margin_percentage}% margin</span>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => startEdit(p)}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            disabled={deleting === p.id} onClick={() => handleDelete(p.id)}>
                            {deleting === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                    </div>
                )
            ))}

            {showAdd ? (
                <PricingRowForm form={addForm} onChange={setAddForm}
                    onSave={() => handleSave(addForm)}
                    onCancel={() => { setShowAdd(false); setAddForm(EMPTY_PRICING); }}
                    isSaving={saving === "new"}
                    suggestedLabels={DEFAULT_LABELS.filter(l => !variant.pricing.some(p => p.label === l))} />
            ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => setShowAdd(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Price Category
                </Button>
            )}

            {variant.pricing.length === 0 && !showAdd && (
                <p className="text-[10px] text-muted-foreground/60 italic">
                    No default pricing yet — add categories as fallback when no season matches.
                </p>
            )}
        </div>
    );
}

// ── Seasons Summary Panel (read-only, in expanded view) ───────────────────

function SeasonsSummaryPanel({ seasons }: { seasons: ActivityVariant["seasons"] }) {
    if (!seasons?.length) return (
        <div className="px-4 pb-3 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3" /> Seasonal Pricing
            </p>
            <p className="text-[10px] text-muted-foreground/60 italic">No seasons — edit the variant to add seasons.</p>
        </div>
    );

    return (
        <div className="px-4 pb-3 pt-1 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Seasonal Pricing
            </p>
            {seasons.map(s => (
                <div key={s.id}
                    className={cn("border rounded-lg overflow-hidden", !s.is_active && "opacity-50")}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-muted/30">
                        <span className="font-medium shrink-0">
                            {toISODate(s.valid_from) ? fmtMonthDay(toISODate(s.valid_from)) : ""} → {toISODate(s.valid_to) ? fmtMonthDay(toISODate(s.valid_to)) : ""}
                        </span>
                        {s.pricing.length > 0 && (
                            <span className="text-primary/80 font-semibold ml-1">
                                ₹{Number(s.pricing[0].price).toLocaleString()}
                            </span>
                        )}
                        {!s.is_active && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">Inactive</Badge>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Variant Row ───────────────────────────────────────────────────────────

function VariantRow({
    variant, activityId, editId, isPending,
    onEdit, onSaveEdit, onCancelEdit, onDelete, onPricingUpdated,
}: {
    variant:          ActivityVariant;
    activityId:       number;
    editId:           number | null;
    isPending:        boolean;
    onEdit:           (id: number) => void;
    onSaveEdit:       (id: number, form: VariantFormState) => void;
    onCancelEdit:     () => void;
    onDelete:         (id: number) => void;
    onPricingUpdated: (variantId: number, pricing: ActivityVariantPricing[]) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    if (editId === variant.id) {
        return (
            <div className="p-3 border rounded-lg">
                <VariantForm
                    initial={toVariantFormState(variant)}
                    onSave={form => onSaveEdit(variant.id, form)}
                    onCancel={onCancelEdit}
                    isSaving={isPending}
                />
            </div>
        );
    }

    const pricingSummary = variant.pricing
        .filter(p => p.is_active)
        .map(p => `${p.label}: ₹${p.price.toLocaleString()}`)
        .join(" · ");

    const seasonCount = variant.seasons?.length ?? 0;

    return (
        <div className={cn("border rounded-lg overflow-hidden", !variant.is_active && "opacity-60")}>
            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20">
                <button type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setExpanded(v => !v)}>
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{variant.name}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{variant.booking_mode}</Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {variant.pricing_type.replace("_", " ")}
                        </Badge>
                        {!variant.is_active && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Inactive</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {pricingSummary && <p className="text-[10px] text-primary/80">{pricingSummary}</p>}
                        {(variant.min_persons || variant.max_persons) && (
                            <p className="text-[10px] text-muted-foreground">
                                {variant.min_persons ?? 1}–{variant.max_persons ?? "∞"} pax
                            </p>
                        )}
                        {seasonCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300">
                                <Calendar className="h-2.5 w-2.5 mr-1" />
                                {seasonCount} season{seasonCount !== 1 ? "s" : ""}
                            </Badge>
                        ) : (
                            <span className="text-[10px] text-destructive/70 italic">no seasons — edit to add</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <p className="text-[10px] text-muted-foreground">GST {variant.gst_percentage}%</p>
                    {variant.cost_price && (
                        <p className="text-[10px] text-muted-foreground">Cost ₹{variant.cost_price.toLocaleString()}</p>
                    )}
                </div>

                <div className="flex gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => onEdit(variant.id)}>
                        <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isPending}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Variant</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Delete <span className="font-semibold">{variant.name}</span>? All seasons and pricing will also be deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(variant.id)}
                                    className="bg-destructive text-white hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {expanded && (
                <div className="border-t bg-muted/10 divide-y divide-border/50">
                    <SeasonsSummaryPanel seasons={variant.seasons ?? []} />
                    <PricingPanel
                        variant={variant}
                        activityId={activityId}
                        onUpdated={onPricingUpdated}
                    />
                </div>
            )}
        </div>
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────

export function VariantsTab({
    activity_id,
    initialVariants,
}: {
    activity_id:     number;
    initialVariants: ActivityVariant[];
}) {
    const [variants, setVariants]          = useState<ActivityVariant[]>(initialVariants);
    const [adding, setAdding]              = useState(false);
    const [editId, setEditId]              = useState<number | null>(null);
    const [isPending, startTransition]     = useTransition();

    function buildSeasonsInput(form: VariantFormState): ActivitySeasonInput[] {
        return form.seasons.map(s => ({
            season_name: s.valid_from && s.valid_to
                ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`
                : "Season",
            valid_from: s.valid_from,
            valid_to:   s.valid_to,
            is_active:  s.is_active,
            pricing: s.price && Number(s.price) > 0 ? [{
                label:             "Base",
                price:             Number(s.price),
                original_price:    null,
                margin_percentage: 0,
                is_active:         true,
            }] : [],
        }));
    }

    function buildOptimisticSeasons(
        seasonsInput: ActivitySeasonInput[],
        variantId: number,
        baseTime: number,
    ): ActivityVariant["seasons"] {
        return seasonsInput.map((s, i) => ({
            id:          baseTime + i,
            variant_id:  variantId,
            season_name: s.season_name,
            valid_from:  new Date(s.valid_from),
            valid_to:    new Date(s.valid_to),
            is_active:   s.is_active,
            sort_order:  i,
            pricing:     s.pricing.map((p, j) => ({
                id:                baseTime + i * 100 + j,
                season_id:         baseTime + i,
                label:             p.label,
                age_from:          p.age_from  ?? null,
                age_to:            p.age_to    ?? null,
                price:             p.price,
                original_price:    p.original_price ?? null,
                margin_percentage: p.margin_percentage ?? 0,
                is_active:         p.is_active,
                sort_order:        j,
            })),
        }));
    }

    function handleAdd(form: VariantFormState) {
        startTransition(async () => {
            const seasonsInput = buildSeasonsInput(form);
            const res = await createVariantWithSeasons(activity_id, {
                name:           form.name,
                booking_mode:   form.booking_mode,
                pricing_type:   form.pricing_type,
                min_persons:    form.min_persons ? Number(form.min_persons) : null,
                max_persons:    form.max_persons ? Number(form.max_persons) : null,
                cost_price:     form.cost_price  ? Number(form.cost_price)  : null,
                gst_percentage: Number(form.gst_percentage) || 5,
                is_active:      form.is_active,
                seasons:        seasonsInput,
            });
            if (!res.success) { toast.error(res.message); return; }
            toast.success(res.message);
            setAdding(false);
            const variantId = res.id!;
            const now = Date.now();
            setVariants(prev => [...prev, {
                id:             variantId,
                activity_id,
                name:           form.name,
                booking_mode:   form.booking_mode,
                pricing_type:   form.pricing_type,
                min_persons:    form.min_persons ? Number(form.min_persons) : null,
                max_persons:    form.max_persons ? Number(form.max_persons) : null,
                cost_price:     form.cost_price  ? Number(form.cost_price)  : null,
                gst_percentage: Number(form.gst_percentage) || 5,
                valid_from:     null,
                valid_to:       null,
                is_active:      form.is_active,
                sort_order:     prev.length,
                pricing:        [],
                seasons:        buildOptimisticSeasons(seasonsInput, variantId, now),
            }]);
        });
    }

    function handleEdit(id: number, form: VariantFormState) {
        startTransition(async () => {
            const seasonsInput = buildSeasonsInput(form);
            const res = await updateVariantWithSeasons(id, activity_id, {
                name:           form.name,
                booking_mode:   form.booking_mode,
                pricing_type:   form.pricing_type,
                min_persons:    form.min_persons ? Number(form.min_persons) : null,
                max_persons:    form.max_persons ? Number(form.max_persons) : null,
                cost_price:     form.cost_price  ? Number(form.cost_price)  : null,
                gst_percentage: Number(form.gst_percentage) || 5,
                is_active:      form.is_active,
                seasons:        seasonsInput,
            });
            if (!res.success) { toast.error(res.message); return; }
            toast.success(res.message);
            setEditId(null);
            const now = Date.now();
            setVariants(prev => prev.map(v => v.id === id ? {
                ...v,
                name:           form.name,
                booking_mode:   form.booking_mode,
                pricing_type:   form.pricing_type,
                min_persons:    form.min_persons ? Number(form.min_persons) : null,
                max_persons:    form.max_persons ? Number(form.max_persons) : null,
                cost_price:     form.cost_price  ? Number(form.cost_price)  : null,
                gst_percentage: Number(form.gst_percentage) || 5,
                is_active:      form.is_active,
                seasons:        buildOptimisticSeasons(seasonsInput, id, now),
            } : v));
        });
    }

    function handleDelete(id: number) {
        startTransition(async () => {
            const res = await deleteVariant(id, activity_id);
            if (res.success) {
                toast.success(res.message);
                setVariants(prev => prev.filter(v => v.id !== id));
            } else {
                toast.error(res.message);
            }
        });
    }

    function handlePricingUpdated(variantId: number, pricing: ActivityVariantPricing[]) {
        setVariants(prev => prev.map(v => v.id === variantId ? { ...v, pricing } : v));
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="h-4 w-4" /> Variants & Pricing
                        </CardTitle>
                        <CardDescription>
                            {variants.length} variant{variants.length !== 1 ? "s" : ""} · Each variant requires at least one season · Expand to manage fallback pricing
                        </CardDescription>
                    </div>
                    {!adding && editId === null && (
                        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Variant
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {adding && (
                    <VariantForm
                        initial={EMPTY_VARIANT_FORM}
                        onSave={handleAdd}
                        onCancel={() => setAdding(false)}
                        isSaving={isPending}
                    />
                )}

                {variants.length > 0 ? (
                    <div className="space-y-2">
                        {variants.map(variant => (
                            <VariantRow
                                key={variant.id}
                                variant={variant}
                                activityId={activity_id}
                                editId={editId}
                                isPending={isPending}
                                onEdit={setEditId}
                                onSaveEdit={handleEdit}
                                onCancelEdit={() => setEditId(null)}
                                onDelete={handleDelete}
                                onPricingUpdated={handlePricingUpdated}
                            />
                        ))}
                    </div>
                ) : !adding && (
                    <div className="text-center py-10 text-muted-foreground">
                        <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No variants yet</p>
                        <p className="text-xs mt-1">Add a variant with season-based pricing (Adult, Child, Infant…)</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
