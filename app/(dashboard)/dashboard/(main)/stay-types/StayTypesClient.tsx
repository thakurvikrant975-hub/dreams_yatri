"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch }   from "../components/ui/switch";
import { Badge }    from "../components/ui/badge";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Hotel } from "lucide-react";
import { toast } from "sonner";
import {
  createStayType, updateStayType,
  toggleStayTypeActive, deleteStayType,
  type StayType,
} from "./actions";

// ── Dialog ────────────────────────────────────────────────────────────────

function StayTypeDialog({
  open, onOpenChange, existing,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  existing?: StayType;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name,       setName]       = useState(existing?.name        ?? "");
  const [slug,       setSlug]       = useState(existing?.slug        ?? "");
  const [description,setDesc]       = useState(existing?.description ?? "");
  const [sortOrder,  setSortOrder]  = useState(existing?.sort_order  ?? 0);
  const [isActive,   setIsActive]   = useState(existing?.is_active   ?? true);
  const [slugEdited, setSlugEdited] = useState(!!existing);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) {
      setSlug(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("name",        name);
      fd.append("slug",        slug);
      fd.append("description", description);
      fd.append("sort_order",  String(sortOrder));
      fd.append("is_active",   String(isActive));

      const r = existing
        ? await updateStayType(existing.id, { success: false, message: "" }, fd)
        : await createStayType({ success: false, message: "" }, fd);

      if (r.success) {
        toast.success(r.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Stay Type" : "New Stay Type"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => handleNameChange(e.target.value)}
              placeholder="Deluxe" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Slug <span className="text-destructive">*</span></Label>
            <Input
              value={slug}
              onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }}
              readOnly={!!existing}
              className={existing ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
            />
            {existing && <p className="text-xs text-muted-foreground">Slug cannot change after creation</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="4-star hotels and above" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Sort Order</Label>
            <Input type="number" min="0" value={sortOrder}
              onChange={e => setSortOrder(Number(e.target.value))} className="w-28" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <p className="text-sm font-medium">Active</p>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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

// ── Main ──────────────────────────────────────────────────────────────────

export function StayTypesClient({ stayTypes: initial }: { stayTypes: StayType[] }) {
  const router = useRouter();
  const [stayTypes,  setStayTypes]  = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<StayType | null>(null);
  const [isPending,  startTransition] = useTransition();

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleStayTypeActive(id, !current);
      setStayTypes(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
      toast.success(`${!current ? "Activated" : "Deactivated"}`);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const r = await deleteStayType(id);
      if (r.success) {
        setStayTypes(prev => prev.filter(s => s.id !== id));
        toast.success(r.message);
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Stay Type
        </Button>
      </div>

      {stayTypes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Hotel className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No stay types yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create "Standard", "Deluxe", "Super Deluxe" etc. — then assign them to packages
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Packages</TableHead>
                <TableHead className="text-center">Sort</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stayTypes.map(st => (
                <TableRow key={st.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{st.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{st.slug}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {st.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">{st._count.packages}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">#{st.sort_order}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={st.is_active} disabled={isPending}
                      onCheckedChange={() => handleToggle(st.id, st.is_active)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setEditTarget(st)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Stay Type</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete <strong>{st.name}</strong>?
                              {st._count.packages > 0 && (
                                <span className="block mt-2 text-destructive font-medium">
                                  ⚠ Used in {st._count.packages} package(s). Remove from packages first.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(st.id)}
                              disabled={st._count.packages > 0 || isPending}
                              className="bg-destructive text-white hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StayTypeDialog open={showCreate} onOpenChange={setShowCreate} />
      {editTarget && (
        <StayTypeDialog
          open={!!editTarget}
          onOpenChange={o => !o && setEditTarget(null)}
          existing={editTarget}
        />
      )}
    </div>
  );
}