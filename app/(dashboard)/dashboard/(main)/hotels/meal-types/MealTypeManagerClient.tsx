"use client";

import { useState, useTransition } from "react";
import { Badge }   from "../../components/ui/badge";
import { Button }  from "../../components/ui/button";
import { Input }   from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X, Loader2, Coffee, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import type { HotelFormState } from "../actions";
import { cn } from "@/app/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────

const MEAL_OPTIONS = [
  { key: "breakfast", label: "Breakfast", Icon: Coffee, activeClass: "bg-orange-100 border-orange-400 text-orange-600", inactiveClass: "bg-muted/40 border-border text-muted-foreground" },
  { key: "lunch",     label: "Lunch",     Icon: Sun,    activeClass: "bg-yellow-100 border-yellow-400 text-yellow-600", inactiveClass: "bg-muted/40 border-border text-muted-foreground" },
  { key: "dinner",    label: "Dinner",    Icon: Moon,   activeClass: "bg-indigo-100 border-indigo-400 text-indigo-600", inactiveClass: "bg-muted/40 border-border text-muted-foreground" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────

type MealTypeItem = { id: number; name: string; covered_meals: string[] };

// ── Meal toggles ──────────────────────────────────────────────────────────

function MealToggles({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {MEAL_OPTIONS.map(({ key, label, Icon, activeClass, inactiveClass }) => {
        const active = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(active ? value.filter((v) => v !== key) : [...value, key])}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none",
              active ? activeClass : inactiveClass,
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            {active && <Check className="h-2.5 w-2.5 ml-0.5" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Inline Edit Row ───────────────────────────────────────────────────────

function EditRow({
  item,
  onSave,
  onCancel,
  isSaving,
}: {
  item: MealTypeItem;
  onSave: (name: string, coveredMeals: string[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name,         setName]         = useState(item.name);
  const [coveredMeals, setCoveredMeals] = useState<string[]>(item.covered_meals);
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
          className="h-8 text-sm max-w-xs"
          autoFocus
        />
        <Button
          type="button"
          size="icon"
          className="h-8 w-8"
          disabled={!name.trim() || isSaving}
          onClick={() => onSave(name, coveredMeals)}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <MealToggles value={coveredMeals} onChange={setCoveredMeals} />
    </div>
  );
}

// ── Add Row ───────────────────────────────────────────────────────────────

function AddRow({
  onSave,
  onCancel,
  isSaving,
}: {
  onSave: (name: string, coveredMeals: string[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name,         setName]         = useState("");
  const [coveredMeals, setCoveredMeals] = useState<string[]>([]);
  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="e.g. Breakfast Included"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
          className="h-8 text-sm max-w-xs"
          autoFocus
        />
        <Button
          type="button"
          size="icon"
          className="h-8 w-8"
          disabled={!name.trim() || isSaving}
          onClick={() => onSave(name, coveredMeals)}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <MealToggles value={coveredMeals} onChange={setCoveredMeals} />
    </div>
  );
}

// ── Meal badges ───────────────────────────────────────────────────────────

function MealBadges({ covered }: { covered: string[] }) {
  if (!covered.length) return <span className="text-xs text-muted-foreground">No meals</span>;
  return (
    <div className="flex gap-1">
      {MEAL_OPTIONS.filter((m) => covered.includes(m.key)).map(({ key, label, Icon }) => (
        <span key={key} className="flex items-center gap-0.5 text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </span>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function MealTypeManagerClient({
  items: initialItems,
  onCreate,
  onUpdate,
  onDelete,
}: {
  items: MealTypeItem[];
  onCreate: (name: string, coveredMeals: string[]) => Promise<HotelFormState>;
  onUpdate: (id: number, name: string, coveredMeals: string[]) => Promise<HotelFormState>;
  onDelete: (id: number) => Promise<HotelFormState>;
}) {
  const [items,  setItems]  = useState<MealTypeItem[]>(initialItems);
  const [editId, setEditId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAdd(name: string, coveredMeals: string[]) {
    startTransition(async () => {
      const result = await onCreate(name, coveredMeals);
      if (result.success) {
        toast.success(result.message);
        setItems((prev) =>
          [...prev, { id: Date.now(), name: name.trim(), covered_meals: coveredMeals }]
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setAdding(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleUpdate(id: number, name: string, coveredMeals: string[]) {
    startTransition(async () => {
      const result = await onUpdate(id, name, coveredMeals);
      if (result.success) {
        toast.success(result.message);
        setItems((prev) =>
          prev
            .map((item) => item.id === id ? { ...item, name: name.trim(), covered_meals: coveredMeals } : item)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditId(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await onDelete(id);
      if (result.success) {
        toast.success(result.message);
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Meal Types</CardTitle>
            <CardDescription>
              Define meal plans and which meals (breakfast / lunch / dinner) they cover — used in hotel pricing plans
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm font-semibold px-2.5">
            {items.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        {items.map((item) =>
          editId === item.id ? (
            <EditRow
              key={item.id}
              item={item}
              onSave={(name, cm) => handleUpdate(item.id, name, cm)}
              onCancel={() => setEditId(null)}
              isSaving={isPending}
            />
          ) : (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg px-3 bg-dashboard-base-200 py-2 hover:bg-muted/50 group transition-colors"
            >
              <div className="space-y-0.5">
                <span className="text-sm font-medium">{item.name}</span>
                <MealBadges covered={item.covered_meals} />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditId(item.id)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove it from the list. If any pricing plan uses this, the
                        deletion will be blocked.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(item.id)}
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
        )}

        {items.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No meal types yet — click "Add" to create one.
          </p>
        )}

        {adding ? (
          <AddRow
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            isSaving={isPending}
          />
        ) : (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="border-dashed w-full bg-dashboard-primary hover:bg-dashboard-primary text-dashboard-base-100 hover:text-dashboard-base-100 py-6"
              onClick={() => setAdding(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Meal Type
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
