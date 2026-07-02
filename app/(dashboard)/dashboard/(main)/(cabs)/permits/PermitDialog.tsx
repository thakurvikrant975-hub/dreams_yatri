"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, FileKey, MapPin, Building2, IndianRupee, CalendarClock, FileText, Tag } from "lucide-react";
import { Button }   from "../../components/ui/button";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "../../components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import { cn }    from "@/app/lib/utils";

import { LocationSearchSelect }  from "../../components/location/LocationSearchSelect";
import type { LocationValue }    from "../../components/location/location.types";

import { createPermit, updatePermit } from "./actions";
import {
  PERMIT_CATEGORIES, PERMIT_VALIDITY_TYPES,
  CATEGORY_LABELS, VALIDITY_LABELS,
  CUSTOM_CATEGORY_VALUE,
  type PermitRow, type PermitInput, type PermitCategory, type PermitValidityType,
} from "./permit.types";

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, description }: {
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ── Form state ─────────────────────────────────────────────────────────────

// categorySelection is either a real PermitCategory or the sentinel "__CUSTOM__"
type CategorySelection = PermitCategory | typeof CUSTOM_CATEGORY_VALUE;

type FormState = {
  name:               string;
  categorySelection:  CategorySelection;
  customCategoryText: string;
  location:           LocationValue | null;
  issuing_authority:  string;
  price_per_vehicle:  string;
  price_per_person:   string;
  validity_type:      PermitValidityType;
  validity_days:      string;
  notes:              string;
};

function blank(): FormState {
  return {
    name:               "",
    categorySelection:  "ENTRY_FEE",
    customCategoryText: "",
    location:           null,
    issuing_authority:  "",
    price_per_vehicle:  "0",
    price_per_person:   "",
    validity_type:      "SINGLE_TRIP",
    validity_days:      "",
    notes:              "",
  };
}

function fromPermit(p: PermitRow): FormState {
  const isCustom = p.category === "OTHER" && !!p.custom_category;
  return {
    name:               p.name,
    categorySelection:  isCustom ? CUSTOM_CATEGORY_VALUE : p.category,
    customCategoryText: p.custom_category ?? "",
    location:           p.location_id && p.location_name
      ? { id: p.location_id, name: p.location_name, slug: "", type: "CITY" as const, breadcrumb: p.location_name }
      : null,
    issuing_authority:  p.issuing_authority ?? "",
    price_per_vehicle:  String(p.price_per_vehicle),
    price_per_person:   p.price_per_person != null ? String(p.price_per_person) : "",
    validity_type:      p.validity_type,
    validity_days:      p.validity_days != null ? String(p.validity_days) : "",
    notes:              p.notes ?? "",
  };
}

// ── Dialog component ───────────────────────────────────────────────────────

export function PermitDialog({
  permit,
  open,
  onOpenChange,
  onSaved,
}: {
  permit?:       PermitRow;
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  onSaved?:      (saved: PermitRow) => void;
}) {
  const isEdit = !!permit;
  const [form, setForm]     = useState<FormState>(permit ? fromPermit(permit) : blank());
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setForm(permit ? fromPermit(permit) : blank());
      setError(null);
    }
  }, [open, permit]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setError(null);
  }

  const isCustomCategory = form.categorySelection === CUSTOM_CATEGORY_VALUE;

  function buildInput(): PermitInput | null {
    const name = form.name.trim();
    if (!name) { setError("Permit name is required"); return null; }

    // Resolve category
    let resolvedCategory: PermitCategory;
    let customCategory: string | null = null;
    if (isCustomCategory) {
      const text = form.customCategoryText.trim();
      if (!text) { setError("Enter a custom category name"); return null; }
      resolvedCategory = "OTHER";
      customCategory   = text;
    } else {
      resolvedCategory = form.categorySelection as PermitCategory;
    }

    const pvRaw = parseFloat(form.price_per_vehicle);
    if (isNaN(pvRaw) || pvRaw < 0) { setError("Enter a valid vehicle price"); return null; }

    const ppRaw = form.price_per_person.trim() ? parseFloat(form.price_per_person) : null;
    if (ppRaw !== null && (isNaN(ppRaw) || ppRaw < 0)) {
      setError("Enter a valid per-person price"); return null;
    }

    const vDays = form.validity_type === "MULTI_DAY"
      ? (form.validity_days.trim() ? parseInt(form.validity_days, 10) : null)
      : null;
    if (form.validity_type === "MULTI_DAY" && (!vDays || vDays < 1)) {
      setError("Enter number of validity days"); return null;
    }

    return {
      name,
      category:           resolvedCategory,
      custom_category:    customCategory,
      location_id:        form.location?.id ?? null,
      issuing_authority:  form.issuing_authority.trim() || null,
      price_per_vehicle:  pvRaw,
      price_per_person:   ppRaw,
      validity_type:      form.validity_type,
      validity_days:      vDays,
      notes:              form.notes.trim() || null,
    };
  }

  function handleSubmit() {
    const input = buildInput();
    if (!input) return;

    startTransition(async () => {
      const res = isEdit
        ? await updatePermit(permit!.id, input)
        : await createPermit(input);

      if (res.success) {
        toast.success(isEdit ? "Permit updated" : "Permit created");
        onSaved?.(res.data);
        onOpenChange(false);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">

        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            {isEdit ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
            {isEdit ? "Edit Permit" : "Add Permit"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit ? "Update the permit details below" : "Fill in the details to create a new permit"}
          </p>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Basic Info ── */}
          <div>
            <SectionHeader
              icon={<FileKey className="h-4 w-4" />}
              title="Basic Info"
              description="Name and category of the permit"
            />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Permit Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Rohtang Pass Permit, Wildlife Entry Fee"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select
                  value={form.categorySelection}
                  onValueChange={(v) => set("categorySelection", v as CategorySelection)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_CATEGORY_VALUE}>
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        Custom…
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isCustomCategory && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    Custom Category Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.customCategoryText}
                    onChange={(e) => set("customCategoryText", e.target.value)}
                    placeholder="e.g. Heritage Site, Eco Zone"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t" />

          {/* ── Location & Authority ── */}
          <div>
            <SectionHeader
              icon={<MapPin className="h-4 w-4" />}
              title="Location & Authority"
              description="Where this permit is required and who issues it"
            />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <LocationSearchSelect
                  value={form.location}
                  onChange={(v) => set("location", v)}
                  types={["CITY", "STATE", "DISTRICT", "AREA", "REGION", "SUBREGION"]}
                  placeholder="Search location…"
                  disableExternalSearch
                  hideRecent
                />
                <p className="text-xs text-muted-foreground">
                  The location where this permit is applicable
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Issuing Authority
                </Label>
                <Input
                  value={form.issuing_authority}
                  onChange={(e) => set("issuing_authority", e.target.value)}
                  placeholder="e.g. District Administration Manali, Forest Department"
                />
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* ── Pricing ── */}
          <div>
            <SectionHeader
              icon={<IndianRupee className="h-4 w-4" />}
              title="Pricing"
              description="Set the cost for vehicle and/or per person"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price per Vehicle <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input
                    className="pl-7"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_per_vehicle}
                    onChange={(e) => set("price_per_vehicle", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Price per Person</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input
                    className="pl-7"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_per_person}
                    onChange={(e) => set("price_per_person", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* ── Validity ── */}
          <div>
            <SectionHeader
              icon={<CalendarClock className="h-4 w-4" />}
              title="Validity"
              description="How long the permit remains valid after issue"
            />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Validity Type <span className="text-destructive">*</span></Label>
                <Select value={form.validity_type} onValueChange={(v) => set("validity_type", v as PermitValidityType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_VALIDITY_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>{VALIDITY_LABELS[v]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.validity_type === "MULTI_DAY" && (
                <div className="space-y-1.5">
                  <Label>Number of Days <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.validity_days}
                    onChange={(e) => set("validity_days", e.target.value)}
                    placeholder="e.g. 7"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t" />

          {/* ── Notes ── */}
          <div>
            <SectionHeader
              icon={<FileText className="h-4 w-4" />}
              title="Notes"
              description="Any additional information about this permit"
            />
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Required for all vehicles entering Rohtang Pass between May–November. Booking required online 2 days in advance."
              rows={3}
              className="resize-none"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-5 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} className={cn(isPending && "opacity-70")}>
            {isPending ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Permit")}
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  );
}
