"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import {
  handleCreateStayCategory,
  handleUpdateStayCategory,
  handleDeleteStayCategory,
  handleReorderStayCategories,
} from "@/app/actions/packages/itinerary-builder.actions";
import type { StayCategoryFull, StayCategoryInput } from "@/app/services/itinerary-builder.service";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Check,
  Star,
  Hotel,
} from "lucide-react";
import { cn, capitalizeWords } from "@/app/lib/utils";

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  packageId: number;
  initialCategories: StayCategoryFull[];
  onCategoriesChange: (cats: StayCategoryFull[]) => void;
};

// ── Category form (add + edit) ─────────────────────────────────────────────

function CategoryForm({
  initial,
  onSave,
  onCancel,
  pending,
}: {
  initial?: StayCategoryFull;
  onSave: (data: StayCategoryInput) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [minDays, setMinDays] = useState(initial?.min_duration_days?.toString() ?? "");
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const uid = initial?.id ?? "new";

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-[10px]">
            Tier Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(capitalizeWords(e.target.value))}
            className="h-8 text-xs mt-0.5"
            placeholder="e.g. Budget, Deluxe, Luxury"
            autoFocus
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-[10px]">Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 text-xs mt-0.5"
            placeholder="Short description (optional)"
          />
        </div>
        <div>
          <Label className="text-[10px]">Min Duration Days</Label>
          <Input
            type="number"
            min={1}
            value={minDays}
            onChange={(e) => setMinDays(e.target.value)}
            className="h-8 text-xs mt-0.5"
            placeholder="e.g. 3"
          />
          <p className="text-[9px] text-muted-foreground/60 mt-0.5">
            Package must have ≥ this many days for tier to appear
          </p>
        </div>
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id={`default-${uid}`}
              checked={isDefault}
              onCheckedChange={setIsDefault}
              disabled={pending}
            />
            <Label htmlFor={`default-${uid}`} className="text-xs">Default tier</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`active-${uid}`}
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={pending}
            />
            <Label htmlFor={`active-${uid}`} className="text-xs">Active</Label>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() =>
            onSave({
              label: label.trim(),
              description: description.trim() || null,
              min_duration_days: minDays ? parseInt(minDays, 10) : null,
              is_default: isDefault,
              is_active: isActive,
            })
          }
          disabled={pending || !label.trim()}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {initial ? "Save Changes" : "Add Tier"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function StayTiersSection({ packageId, initialCategories, onCategoriesChange }: Props) {
  const [expanded, setExpanded] = useState(initialCategories.length === 0);
  const [categories, setCategories] = useState<StayCategoryFull[]>(initialCategories);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function sync(updated: StayCategoryFull[]) {
    const sorted = [...updated].sort((a, b) => a.sort_order - b.sort_order);
    setCategories(sorted);
    onCategoriesChange(sorted);
  }

  function handleAdd(data: StayCategoryInput) {
    startTransition(async () => {
      const res = await handleCreateStayCategory(packageId, data);
      if (!res.success) { toast.error(res.message); return; }
      const newCat = res.data as StayCategoryFull;
      let updated = [...categories, newCat];
      if (data.is_default) updated = updated.map((c) => c.id === newCat.id ? c : { ...c, is_default: false });
      sync(updated);
      setAdding(false);
      toast.success(`"${data.label}" tier added`);
    });
  }

  function handleEdit(id: number, data: StayCategoryInput) {
    startTransition(async () => {
      const res = await handleUpdateStayCategory(id, data, packageId);
      if (!res.success) { toast.error(res.message); return; }
      const updated_cat = res.data as StayCategoryFull;
      let list = categories.map((c) => c.id === id ? updated_cat : c);
      if (data.is_default) list = list.map((c) => c.id === id ? c : { ...c, is_default: false });
      sync(list);
      setEditingId(null);
      toast.success("Tier updated");
    });
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const res = await handleDeleteStayCategory(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    sync(categories.filter((c) => c.id !== id));
    toast.success("Tier deleted");
  }

  function handleMove(id: number, dir: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sorted.length - 1) return;

    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    const aOrder = sorted[idx].sort_order;
    const bOrder = sorted[swapIdx].sort_order;

    const updated = sorted.map((c, i) => {
      if (i === idx) return { ...c, sort_order: bOrder };
      if (i === swapIdx) return { ...c, sort_order: aOrder };
      return c;
    });

    sync(updated);
    handleReorderStayCategories(
      [
        { id: updated[idx].id, sort_order: updated[idx].sort_order },
        { id: updated[swapIdx].id, sort_order: updated[swapIdx].sort_order },
      ],
      packageId,
    );
  }

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="rounded-xl border border-dashboard-base-content/30 overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-dashboard-base-100 bg-dashboard-base-content transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
          <Hotel className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Stay Tiers</span>
          {categories.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {categories.length} configured
            </Badge>
          )}
        </div>
        {!expanded && categories.length > 0 && (
          <span className="text-xs text-dashboard-base-100 truncate max-w-xs hidden sm:block">
            {sorted.map((c) => c.label).join(" · ")}
          </span>
        )}
        {!expanded && categories.length === 0 && (
          <span className="text-xs text-dashboard-base-100 italic">None yet — click to add</span>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-3">
          {sorted.length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed bg-muted/20">
              <Hotel className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No stay tiers yet</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5 mb-3 text-center max-w-56">
                Define hotel quality tiers for this package (e.g. Budget, Deluxe, Luxury)
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Tier
              </Button>
            </div>
          ) : (
            <>
              {sorted.length > 0 && (
                <div className="space-y-2">
                  {sorted.map((cat, idx) => (
                    <div key={cat.id} className={cn("rounded-lg border bg-background transition-colors", !cat.is_active && "opacity-60")}>
                      {editingId === cat.id ? (
                        <div className="p-3">
                          <CategoryForm
                            initial={cat}
                            onSave={(data) => handleEdit(cat.id, data)}
                            onCancel={() => setEditingId(null)}
                            pending={isPending}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2.5 border-dashboard-base-content/30 border rounded-md">
                          {/* Up/down reorder */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              className="h-4 w-4 flex items-center justify-center hover:bg-dashboard-base-content/20 hover:text-dashboard-base-content cursor-pointer hover:opacity-100 rounded-md transition-colors disabled:opacity-20"
                              onClick={() => handleMove(cat.id, "up")}
                              disabled={idx === 0}
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-2.5 w-2.5 text-dashboard-base-content" />
                            </button>
                            <button
                              type="button"
                              className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/30 hover:text-muted-foreground transition-colors disabled:opacity-20"
                              onClick={() => handleMove(cat.id, "down")}
                              disabled={idx === sorted.length - 1}
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-2.5 w-2.5" />
                            </button>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium">{cat.label}</span>
                              <span className="text-[10px] font-mono text-dashboard-base-content bg-dashboard-base-content/20 px-1 rounded">
                                {cat.slug}
                              </span>
                              {cat.is_default && (
                                <Badge className="gap-0.5 text-[9px] h-3.5 px-1 py-0">
                                  <Star className="h-2 w-2" />
                                  Default
                                </Badge>
                              )}
                              {!cat.is_active && (
                                <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                              {cat.min_duration_days != null && (
                                <span className="text-[10px] text-dashboard-primary">
                                  Min: {cat.min_duration_days}D
                                </span>
                              )}
                            </div>
                            {cat.description && (
                              <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                                {cat.description}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingId(cat.id);
                                setAdding(false);
                              }}
                              disabled={isPending}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:text-destructive"
                              onClick={() => handleDelete(cat.id)}
                              disabled={deletingId === cat.id || isPending}
                            >
                              {deletingId === cat.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add form or Add button */}
              {adding ? (
                <CategoryForm
                  onSave={handleAdd}
                  onCancel={() => setAdding(false)}
                  pending={isPending}
                />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-dashboard-base-content rounded-md"
                  onClick={() => {
                    setAdding(true);
                    setEditingId(null);
                  }}
                  disabled={isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Tier
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
