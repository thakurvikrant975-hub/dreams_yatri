"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Tag, List, Eye, GripVertical, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import { Switch }   from "../components/ui/switch";
import { Badge }    from "../components/ui/badge";
import { toast }    from "sonner";
import { cn } from "@/app/lib/utils";
import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../components/dashboard/MultiStepModel";
import {
  createPolicy,
  updatePolicy,
  type Policy,
} from "./actions";
import {
  POLICY_TYPE_LABELS,
  POLICY_TYPES,
  POLICY_TYPE_COLORS,
  type PolicyType,
} from "./constants";

// ── Steps ─────────────────────────────────────────────────────────────────

function makeSteps(): Step[] {
  return [
    {
      id:          "details",
      title:       "Details",
      description: "Type, title and settings",
      icon:        <Tag className="h-4 w-4" />,
      validate: (data) => {
        if (!data.type)  return "Please select a policy type";
        if (!data.title) return "Title is required";
        return null;
      },
    },
    {
      id:          "points",
      title:       "Policy Points",
      description: "Add individual policy points",
      icon:        <List className="h-4 w-4" />,
      validate: (data) => {
        const pts = (data.points as string[]) ?? [];
        const valid = pts.filter(p => p.trim());
        if (valid.length === 0) return "Add at least one policy point";
        return null;
      },
    },
    {
      id:          "preview",
      title:       "Preview",
      description: "Review before saving",
      icon:        <Eye className="h-4 w-4" />,
      optional:    true,
    },
  ];
}

// ── Initial data ──────────────────────────────────────────────────────────

function buildInitialData(policy: Policy): Record<string, Record<string, unknown>> {
  return {
    details: {
      type:       policy.type,
      title:      policy.title,
      is_active:  policy.is_active,
      sort_order: String(policy.sort_order),
    },
    points:  { points: policy.points.length > 0 ? policy.points : [""] },
    preview: {},
  };
}

const EMPTY_DATA: Record<string, Record<string, unknown>> = {
  details: { type: "", title: "", is_active: true, sort_order: "0" },
  points:  { points: [""] },
  preview: {},
};

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 — Details
// ─────────────────────────────────────────────────────────────────────────

function DetailsStep({ isEdit }: { isEdit: boolean }) {
  const { stepData, setStepData } = useMultiStep();
  const data       = stepData["details"] ?? {};
  const type       = (data.type       as string)  ?? "";
  const title      = (data.title      as string)  ?? "";
  const is_active  = (data.is_active  as boolean) ?? true;
  const sort_order = (data.sort_order as string)  ?? "0";

  function handleTypeChange(val: string) {
    // Auto-fill title if still empty
    const autoTitle = title || POLICY_TYPE_LABELS[val as PolicyType];
    setStepData("details", { ...data, type: val, title: autoTitle });
  }

  return (
    <div className="space-y-5">

      {/* Type */}
      <div className="space-y-2">
        <Label>Policy Type <span className="text-destructive">*</span></Label>
        {isEdit ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 bg-muted/50">
            <span className={`text-[11px] font-medium px-2 py-1 rounded border ${POLICY_TYPE_COLORS[type as PolicyType]}`}>
              {POLICY_TYPE_LABELS[type as PolicyType]}
            </span>
            <Badge variant="secondary" className="text-xs ml-auto">Cannot change</Badge>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {POLICY_TYPES.map(pt => (
              <button
                key={pt}
                type="button"
                onClick={() => handleTypeChange(pt)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all text-sm",
                  type === pt
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                )}
              >
                <div className={cn(
                  "h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                  type === pt ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}>
                  {type === pt && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <span className="font-medium leading-tight text-xs">
                  {POLICY_TYPE_LABELS[pt]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          placeholder="e.g. Standard Cancellation Policy"
          value={title}
          onChange={e => setStepData("details", { ...data, title: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Use a clear name — you can have multiple policies of the same type with different rules
        </p>
      </div>

      {/* Sort */}
      <div className="space-y-1.5">
        <Label>Sort Order</Label>
        <Input
          type="number"
          min="0"
          className="w-28"
          value={sort_order}
          onChange={e => setStepData("details", { ...data, sort_order: e.target.value })}
        />
      </div>

      {/* Active */}
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground">
            Inactive policies won't appear in package assignment
          </p>
        </div>
        <Switch
          checked={is_active}
          onCheckedChange={v => setStepData("details", { ...data, is_active: v })}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2 — Points editor
// ─────────────────────────────────────────────────────────────────────────

function PointsStep() {
  const { stepData, setStepData } = useMultiStep();
  const data   = stepData["points"] ?? {};
  const points = (data.points as string[]) ?? [""];

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setPoints(updated: string[]) {
    setStepData("points", { points: updated });
  }

  function handleChange(i: number, val: string) {
    const updated = [...points];
    updated[i] = val;
    setPoints(updated);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter → add new point below
    if (e.key === "Enter") {
      e.preventDefault();
      const updated = [...points];
      updated.splice(i + 1, 0, "");
      setPoints(updated);
      // Focus new input after render
      setTimeout(() => inputRefs.current[i + 1]?.focus(), 50);
    }
    // Backspace on empty → delete row and focus previous
    if (e.key === "Backspace" && !points[i] && points.length > 1) {
      e.preventDefault();
      const updated = points.filter((_, idx) => idx !== i);
      setPoints(updated);
      setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 50);
    }
  }

  function addPoint() {
    setPoints([...points, ""]);
    setTimeout(() => inputRefs.current[points.length]?.focus(), 50);
  }

  function removePoint(i: number) {
    if (points.length === 1) {
      setPoints([""]);
      return;
    }
    setPoints(points.filter((_, idx) => idx !== i));
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const updated = [...points];
    [updated[i - 1], updated[i]] = [updated[i], updated[i - 1]];
    setPoints(updated);
  }

  function moveDown(i: number) {
    if (i === points.length - 1) return;
    const updated = [...points];
    [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
    setPoints(updated);
  }

  const validCount = points.filter(p => p.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Policy Points <span className="text-destructive">*</span></Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each point becomes one bullet in the list · Press Enter to add next
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {validCount} point{validCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {points.map((point, i) => (
          <div key={i} className="flex items-center gap-2 group">
            {/* Drag handle — visual only */}
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />

            {/* Bullet indicator */}
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />

            {/* Input */}
            <Input
              ref={el => { inputRefs.current[i] = el; }}
              value={point}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              placeholder={
                i === 0
                  ? "e.g. Full refund if cancelled 30+ days before travel"
                  : "Add another point..."
              }
              className="flex-1 border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent"
            />

            {/* Reorder */}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-30"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === points.length - 1}
                className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-30"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removePoint(i)}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPoint}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2 border border-dashed rounded-lg px-3 py-2 w-full hover:border-muted-foreground/40 hover:bg-muted/30"
      >
        <Plus className="h-3.5 w-3.5" />
        Add point
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3 — Preview
// ─────────────────────────────────────────────────────────────────────────

function PreviewStep() {
  const { stepData } = useMultiStep();
  const details = stepData["details"] ?? {};
  const points  = ((stepData["points"]?.points as string[]) ?? []).filter(p => p.trim());

  return (
    <div className="space-y-4">
      {/* Meta summary */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <span className={`text-[11px] font-medium px-2 py-1 rounded border ${POLICY_TYPE_COLORS[details.type as PolicyType] ?? ""}`}>
            {details.type ? POLICY_TYPE_LABELS[details.type as PolicyType] : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Title</span>
          <span className="font-medium">{(details.title as string) || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={details.is_active ? "default" : "secondary"} className="text-xs">
            {details.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Points</span>
          <span className="font-medium">{points.length}</span>
        </div>
      </div>

      {/* Preview as it will appear on the package page */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          How it will appear
        </p>
        <div className="rounded-lg border p-4 bg-background">
          <p className="text-sm font-semibold text-foreground mb-3">
            {(details.title as string) || POLICY_TYPE_LABELS[details.type as PolicyType] || "Policy Title"}
          </p>
          {points.length > 0 ? (
            <ul className="space-y-2">
              {points.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No points added</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD FORM DATA
// ─────────────────────────────────────────────────────────────────────────

function buildFormData(
  data:     Record<string, unknown>,
  existing?: Policy,
): FormData {
  const fd     = new FormData();
  const points = ((data.points as string[]) ?? existing?.points ?? []).filter(p => (p as string).trim());

  fd.append("type",       (data.type       as string)  ?? existing?.type       ?? "");
  fd.append("title",      (data.title      as string)  ?? existing?.title      ?? "");
  fd.append("points",     JSON.stringify(points));
  fd.append("is_active",  String(data.is_active ?? existing?.is_active ?? true));
  fd.append("sort_order", (data.sort_order as string)  ?? String(existing?.sort_order ?? 0));
  return fd;
}

// ─────────────────────────────────────────────────────────────────────────
// CREATE DIALOG
// ─────────────────────────────────────────────────────────────────────────

export function CreatePolicyDialog() {
  const [open,     setOpen]     = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const STEPS = makeSteps();

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) setModalKey(k => k + 1);
  }

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const fd     = buildFormData(data);
      const result = await createPolicy({ success: false, message: "" }, fd);
      if (result.success) {
        toast.success(result.message);
        handleOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Policy
      </Button>

      <MultiStepModal
        key={modalKey}
        open={open}
        onOpenChange={handleOpenChange}
        title="Create Policy"
        description="Create a reusable policy to assign to packages"
        steps={STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Create Policy"
        initialStepData={EMPTY_DATA}
      >
        <DetailsStep isEdit={false} />
        <PointsStep />
        <PreviewStep />
      </MultiStepModal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EDIT DIALOG
// ─────────────────────────────────────────────────────────────────────────

export function EditPolicyDialog({
  policy,
  open,
  onOpenChange,
}: {
  policy:       Policy;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [modalKey,  setModalKey]     = useState(0);
  const STEPS       = makeSteps();
  const initialData = buildInitialData(policy);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
    if (!val) setModalKey(k => k + 1);
  }

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const fd     = buildFormData(data, policy);
      const result = await updatePolicy(policy.id, { success: false, message: "" }, fd);
      if (result.success) {
        toast.success(result.message);
        handleOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <MultiStepModal
      key={modalKey}
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit Policy"
      description={policy.title}
      steps={STEPS}
      onComplete={handleComplete}
      isSubmitting={isPending}
      submitLabel="Save Changes"
      initialStepData={initialData}
    >
      <DetailsStep isEdit={true} />
      <PointsStep />
      <PreviewStep />
    </MultiStepModal>
  );
}