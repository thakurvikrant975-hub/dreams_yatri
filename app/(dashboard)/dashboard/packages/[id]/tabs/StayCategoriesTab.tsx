"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../../../components/ui/button";
import { Input }    from "../../../components/ui/input";
import { Label }    from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch }   from "../../../components/ui/switch";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "../../../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Hotel } from "lucide-react";
import { toast } from "sonner";
import {
  createStayCategory,
  updateStayCategory,
  deleteStayCategory,
} from "../../actions";

type StayCategory = {
  id:                number;
  slug:              string;
  label:             string;
  description:       string | null;
  min_duration_days: number | null;
  is_default:        boolean;
  is_active:         boolean;
  sort_order:        number;
};

function StayCategoryDialog({
  open, onOpenChange, package_id, existing, nextSortOrder,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  package_id: number; existing?: StayCategory; nextSortOrder: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [label,       setLabel]      = useState(existing?.label             ?? "");
  const [description, setDesc]       = useState(existing?.description       ?? "");
  const [minDays,     setMinDays]    = useState<string>(
    existing?.min_duration_days != null ? String(existing.min_duration_days) : ""
  );
  const [isDefault,   setIsDefault]  = useState(existing?.is_default ?? false);
  const [isActive,    setIsActive]   = useState(existing?.is_active  ?? true);
  const [sortOrder,   setSortOrder]  = useState(existing?.sort_order ?? nextSortOrder);

  function slugify(val: string) {
    return val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSave() {
    if (!label.trim()) { toast.error("Label is required"); return; }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug",              existing?.slug ?? slugify(label));
      fd.append("label",             label);
      fd.append("description",       description);
      fd.append("min_duration_days", minDays);
      fd.append("is_default",        String(isDefault));
      fd.append("is_active",         String(isActive));
      fd.append("sort_order",        String(sortOrder));
      const r = existing
        ? await updateStayCategory(existing.id, package_id, fd)
        : await createStayCategory(package_id, fd);
      if (r.success) {
        toast.success(r.message);
        onOpenChange(false);
        router.refresh(); // ← refresh so new/updated stay category appears
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Stay Type" : "Add Stay Type"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Label <span className="text-destructive">*</span></Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Deluxe" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="4-star hotels with Dal Lake views" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Min Duration Days</Label>
              <Input type="number" min="0" value={minDays}
                onChange={e => setMinDays(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input type="number" min="0" value={sortOrder}
                onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <p className="text-sm">Default</p>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <div className="flex-1 flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <p className="text-sm">Active</p>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StayCategoriesTab({
  package_id,
  stayCategories: initial,
}: {
  package_id:     number;
  stayCategories: StayCategory[];
}) {
  const router = useRouter();
  const [cats,       setCats]       = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<StayCategory | null>(null);
  const [isPending,  startTransition] = useTransition();

  function handleDelete(id: number) {
    startTransition(async () => {
      const r = await deleteStayCategory(id, package_id);
      if (r.success) {
        setCats(prev => prev.filter(c => c.id !== id));
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{cats.length} Stay Type{cats.length !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            e.g. Standard · Deluxe · Super Deluxe — used in pricing matrix
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Stay Type
        </Button>
      </div>

      {cats.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Hotel className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No stay types yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {cats.map(cat => (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{cat.label}</CardTitle>
                    {cat.is_default && <Badge className="text-[10px] mt-1">Default</Badge>}
                    {!cat.is_active && <Badge variant="secondary" className="text-[10px] mt-1">Inactive</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => setEditTarget(cat)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Stay Type</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete <strong>{cat.label}</strong>? This removes all pricing rows for this stay type.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(cat.id)}
                            className="bg-destructive text-white hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
                {cat.description && <p>{cat.description}</p>}
                {cat.min_duration_days != null && <p>Min {cat.min_duration_days} days</p>}
                <p>Sort #{cat.sort_order}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StayCategoryDialog open={showCreate}
        onOpenChange={setShowCreate}
        package_id={package_id}
        nextSortOrder={cats.length}
      />
      {editTarget && (
        <StayCategoryDialog
          open={!!editTarget}
          onOpenChange={o => !o && setEditTarget(null)}
          package_id={package_id}
          existing={editTarget}
          nextSortOrder={cats.length}
        />
      )}
    </div>
  );
}