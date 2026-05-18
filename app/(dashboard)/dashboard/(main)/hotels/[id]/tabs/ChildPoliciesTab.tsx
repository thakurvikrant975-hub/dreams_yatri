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
  { value: "FREE",        label: "Free",            description: "No charge" },
  { value: "SHARING_BED", label: "Sharing Bed",     description: "Shares existing bed, fixed charge" },
  { value: "EXTRA_BED",   label: "Extra Bed",       description: "Extra bed added, per night charge" },
  { value: "FIXED_RATE",  label: "Fixed Rate",      description: "Flat per-night rate" },
];

const CHARGE_LABELS: Record<string, string> = Object.fromEntries(
  CHARGE_TYPES.map((c) => [c.value, c.label])
);

const EMPTY_FORM: FormState = {
  age_from: "",
  age_to: "",
  charge_type: "",
  price: "",
  description: "",
  is_active: true,
};

function needsPrice(chargeType: string) {
  return chargeType === "SHARING_BED" || chargeType === "EXTRA_BED" || chargeType === "FIXED_RATE";
}

// ── Policy Form ───────────────────────────────────────────────────────────

function PolicyForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isValid =
    form.age_from !== "" &&
    form.age_to !== "" &&
    Number(form.age_to) >= Number(form.age_from) &&
    !!form.charge_type &&
    (!needsPrice(form.charge_type) || (!!form.price && Number(form.price) >= 0));

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Age From (yrs) <span className="text-destructive">*</span></Label>
          <Input
            type="number" min={0} max={17} placeholder="0"
            value={form.age_from}
            onChange={(e) => update("age_from", e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Age To (yrs) <span className="text-destructive">*</span></Label>
          <Input
            type="number" min={0} max={17} placeholder="12"
            value={form.age_to}
            onChange={(e) => update("age_to", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Charge Type <span className="text-destructive">*</span></Label>
          <Select value={form.charge_type} onValueChange={(v) => update("charge_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {CHARGE_TYPES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span>{c.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">— {c.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Price / Night (₹) {needsPrice(form.charge_type) && <span className="text-destructive">*</span>}</Label>
          <Input
            type="number" min={0} placeholder="500"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            disabled={!needsPrice(form.charge_type)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input
          placeholder="e.g. Valid with extra mattress, includes meals"
          value={form.description}
          onChange={(e) => { const v = e.target.value; update("description", v.charAt(0).toUpperCase() + v.slice(1)); }}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)}>
            {isSaving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Policy</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────

export function ChildPoliciesTab({
  hotel_id,
  initialPolicies,
}: {
  hotel_id: number;
  initialPolicies: Policy[];
}) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(form: FormState) {
    startTransition(async () => {
      const res = await createChildPolicy(hotel_id, {
        age_from: Number(form.age_from),
        age_to: Number(form.age_to),
        charge_type: form.charge_type,
        price: form.price ? Number(form.price) : null,
        description: form.description || null,
        is_active: form.is_active,
      });
      if (res.success) {
        toast.success(res.message);
        setAdding(false);
        setPolicies((prev) => [
          ...prev,
          {
            id: Date.now(),
            hotel_id,
            age_from: Number(form.age_from),
            age_to: Number(form.age_to),
            charge_type: form.charge_type,
            price: form.price ? Number(form.price) : null,
            description: form.description || null,
            is_active: form.is_active,
            sort_order: prev.length,
          },
        ]);
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleEdit(id: number, form: FormState) {
    startTransition(async () => {
      const res = await updateChildPolicy(id, hotel_id, {
        age_from: Number(form.age_from),
        age_to: Number(form.age_to),
        charge_type: form.charge_type,
        price: form.price ? Number(form.price) : null,
        description: form.description || null,
        is_active: form.is_active,
      });
      if (res.success) {
        toast.success(res.message);
        setEditId(null);
        setPolicies((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  age_from: Number(form.age_from),
                  age_to: Number(form.age_to),
                  charge_type: form.charge_type,
                  price: form.price ? Number(form.price) : null,
                  description: form.description || null,
                  is_active: form.is_active,
                }
              : p
          )
        );
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const res = await deleteChildPolicy(id, hotel_id);
      if (res.success) {
        toast.success(res.message);
        setPolicies((prev) => prev.filter((p) => p.id !== id));
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="h-4 w-4" /> Child Policies
            </CardTitle>
            <CardDescription>
              Define how children are charged by age band. Applies to all rooms in this hotel.
            </CardDescription>
          </div>
          {!adding && editId === null && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Policy
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <PolicyForm
            initial={EMPTY_FORM}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            isSaving={isPending}
          />
        )}

        {policies.length > 0 ? (
          <div className="space-y-2">
            {policies.map((policy) => (
              editId === policy.id ? (
                <PolicyForm
                  key={policy.id}
                  initial={{
                    age_from: String(policy.age_from),
                    age_to: String(policy.age_to),
                    charge_type: policy.charge_type,
                    price: policy.price ? String(policy.price) : "",
                    description: policy.description ?? "",
                    is_active: policy.is_active,
                  }}
                  onSave={(form) => handleEdit(policy.id, form)}
                  onCancel={() => setEditId(null)}
                  isSaving={isPending}
                />
              ) : (
                <div
                  key={policy.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                    !policy.is_active && "opacity-50"
                  )}
                >
                  <Baby className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        Age {policy.age_from}–{policy.age_to} yrs
                      </span>
                      <Badge
                        variant={policy.charge_type === "FREE" ? "secondary" : "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {CHARGE_LABELS[policy.charge_type] ?? policy.charge_type}
                      </Badge>
                      {policy.price !== null && (
                        <span className="text-xs text-muted-foreground">
                          ₹{policy.price.toLocaleString()}/night
                        </span>
                      )}
                    </div>
                    {policy.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{policy.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button" variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditId(policy.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isPending}
                        >
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
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(policy.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )
            ))}
          </div>
        ) : !adding && (
          <div className="text-center py-10 text-muted-foreground">
            <Baby className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No child policies defined</p>
            <p className="text-xs mt-1">Add policies for how children of different ages are charged</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
