"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
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
import { Plus, Pencil, Trash2, Loader2, Check, X, Baby } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { createChildPolicy, updateChildPolicy, deleteChildPolicy } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Policy = {
  id: number;
  hotel_id: number;
  age_from: number;
  age_to: number;
  charge_type: string;
  price: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

type FormState = {
  age_from: string;
  age_to: string;
  charge_type: string;
  price: string;
  description: string;
  is_active: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────

const CHARGE_TYPES = [
  { value: "FREE",        label: "Free",        description: "No charge" },
  { value: "SHARING_BED", label: "Sharing Bed", description: "Shares existing bed, fixed charge" },
  { value: "EXTRA_BED",   label: "Extra Bed",   description: "Extra bed added, per night charge" },
  { value: "FIXED_RATE",  label: "Fixed Rate",  description: "Flat per-night rate" },
];

const CHARGE_LABELS: Record<string, string> = Object.fromEntries(
  CHARGE_TYPES.map((c) => [c.value, c.label])
);

const EMPTY_FORM: FormState = {
  age_from: "", age_to: "", charge_type: "", price: "", description: "", is_active: true,
};

function needsPrice(chargeType: string) {
  return chargeType === "SHARING_BED" || chargeType === "EXTRA_BED" || chargeType === "FIXED_RATE";
}

// ── Policy Form ───────────────────────────────────────────────────────────

function PolicyForm({ initial, onSave, onCancel, isSaving }: {
  initial: FormState; onSave: (form: FormState) => void;
  onCancel: () => void; isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isValid =
    form.age_from !== "" && form.age_to !== "" &&
    Number(form.age_to) >= Number(form.age_from) &&
    !!form.charge_type &&
    (!needsPrice(form.charge_type) || (!!form.price && Number(form.price) >= 0));

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl p-4 space-y-4 bg-dashboard-base-200/60">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Age From (yrs) <span className="text-dashboard-error">*</span></Label>
          <Input
            type="number" min={0} max={17} placeholder="0"
            value={form.age_from} onChange={(e) => update("age_from", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Age To (yrs) <span className="text-dashboard-error">*</span></Label>
          <Input
            type="number" min={0} max={17} placeholder="12"
            value={form.age_to} onChange={(e) => update("age_to", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Charge Type <span className="text-dashboard-error">*</span></Label>
          <Select value={form.charge_type} onValueChange={(v) => update("charge_type", v)}>
            <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {CHARGE_TYPES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                  <span>{c.label}</span>
                  <span className="text-xs text-dashboard-base-content/50 ml-1">— {c.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">
            Price / Night (₹) {needsPrice(form.charge_type) && <span className="text-dashboard-error">*</span>}
          </Label>
          <Input
            type="number" min={0} placeholder="500"
            value={form.price} onChange={(e) => update("price", e.target.value)}
            disabled={!needsPrice(form.charge_type)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-dashboard-base-content">Notes</Label>
        <Input
          placeholder="e.g. Valid with extra mattress, includes meals"
          value={form.description}
          onChange={(e) => { const v = e.target.value; update("description", v.charAt(0).toUpperCase() + v.slice(1)); }}
          className="bg-dashboard-base-100 border-dashboard-base-content/20"
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-dashboard-base-content/10">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
          <span className="text-sm text-dashboard-base-content/60">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}
            className="text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-300 cursor-pointer">
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)}
            className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer">
            {isSaving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Policy</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────

export function ChildPoliciesTab({ hotel_id, initialPolicies }: {
  hotel_id: number; initialPolicies: Policy[];
}) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(form: FormState) {
    startTransition(async () => {
      const res = await createChildPolicy(hotel_id, {
        age_from: Number(form.age_from), age_to: Number(form.age_to),
        charge_type: form.charge_type,
        price: form.price ? Number(form.price) : null,
        description: form.description || null, is_active: form.is_active,
      });
      if (res.success) {
        toast.success(res.message);
        setAdding(false);
        setPolicies((prev) => [...prev, {
          id: Date.now(), hotel_id,
          age_from: Number(form.age_from), age_to: Number(form.age_to),
          charge_type: form.charge_type,
          price: form.price ? Number(form.price) : null,
          description: form.description || null,
          is_active: form.is_active, sort_order: prev.length,
        }]);
      } else { toast.error(res.message); }
    });
  }

  function handleEdit(id: number, form: FormState) {
    startTransition(async () => {
      const res = await updateChildPolicy(id, hotel_id, {
        age_from: Number(form.age_from), age_to: Number(form.age_to),
        charge_type: form.charge_type,
        price: form.price ? Number(form.price) : null,
        description: form.description || null, is_active: form.is_active,
      });
      if (res.success) {
        toast.success(res.message);
        setEditId(null);
        setPolicies((prev) => prev.map((p) =>
          p.id !== id ? p : {
            ...p,
            age_from: Number(form.age_from), age_to: Number(form.age_to),
            charge_type: form.charge_type,
            price: form.price ? Number(form.price) : null,
            description: form.description || null, is_active: form.is_active,
          }
        ));
      } else { toast.error(res.message); }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const res = await deleteChildPolicy(id, hotel_id);
      if (res.success) {
        toast.success(res.message);
        setPolicies((prev) => prev.filter((p) => p.id !== id));
      } else { toast.error(res.message); }
    });
  }

  return (
    <div className="space-y-5 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-dashboard-base-content flex items-center gap-2">
            <Baby className="h-4 w-4 text-dashboard-primary/70" /> Child Policies
          </p>
          <p className="text-xs text-dashboard-base-content/50 mt-0.5">
            Define how children are charged by age band.
          </p>
        </div>
        {!adding && editId === null && (
          <Button size="sm"
            className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
            onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Policy
          </Button>
        )}
      </div>

      {adding && (
        <PolicyForm initial={EMPTY_FORM} onSave={handleAdd}
          onCancel={() => setAdding(false)} isSaving={isPending} />
      )}

      {policies.length > 0 ? (
        <div className="space-y-2">
          {policies.map((policy) =>
            editId === policy.id ? (
              <PolicyForm
                key={policy.id}
                initial={{
                  age_from: String(policy.age_from), age_to: String(policy.age_to),
                  charge_type: policy.charge_type,
                  price: policy.price ? String(policy.price) : "",
                  description: policy.description ?? "", is_active: policy.is_active,
                }}
                onSave={(form) => handleEdit(policy.id, form)}
                onCancel={() => setEditId(null)}
                isSaving={isPending}
              />
            ) : (
              <div
                key={policy.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-dashboard-base-content/20 bg-dashboard-base-100 px-3 py-2.5 transition-colors hover:bg-dashboard-base-200",
                  !policy.is_active && "opacity-50"
                )}
              >
                <Baby className="h-4 w-4 text-dashboard-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dashboard-base-content">
                      Age {policy.age_from}–{policy.age_to} yrs
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0 border",
                        policy.charge_type === "FREE"
                          ? "bg-dashboard-success/10 text-dashboard-success border-dashboard-success/30"
                          : "bg-dashboard-base-200 text-dashboard-base-content/70 border-dashboard-base-content/20"
                      )}
                    >
                      {CHARGE_LABELS[policy.charge_type] ?? policy.charge_type}
                    </Badge>
                    {policy.price !== null && (
                      <span className="text-xs text-dashboard-base-content/50">
                        ₹{policy.price.toLocaleString()}/night
                      </span>
                    )}
                  </div>
                  {policy.description && (
                    <p className="text-xs text-dashboard-base-content/50 mt-0.5">{policy.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon"
                    className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
                    onClick={() => setEditId(policy.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                        disabled={isPending}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Child Policy</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete policy for age {policy.age_from}–{policy.age_to}? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(policy.id)}
                          className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          )}
        </div>
      ) : !adding && (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-dashboard-base-content/20 bg-dashboard-base-200/30">
          <Baby className="h-8 w-8 text-dashboard-base-content/20 mb-3" />
          <p className="text-sm font-medium text-dashboard-base-content/50">No child policies defined</p>
          <p className="text-xs text-dashboard-base-content/40 mt-1">
            Add policies for how children of different ages are charged
          </p>
        </div>
      )}
    </div>
  );
}
