"use client";

import { useState, useTransition, useRef } from "react";
import { Badge }   from "../components/ui/badge";
import { Button }  from "../components/ui/button";
import { Input }   from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { HotelFormState } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type TypeItem = { id: number; name: string };

// ── Inline Edit Row ───────────────────────────────────────────────────────

function EditRow({
  item,
  onSave,
  onCancel,
  isSaving,
}: {
  item: TypeItem;
  onSave: (name: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(item.name);
  return (
    <div className="flex items-center gap-2 py-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(name);
          if (e.key === "Escape") onCancel();
        }}
        className="h-8 text-sm max-w-xs"
        autoFocus
      />
      <Button
        type="button"
        size="icon"
        className="h-8 w-8"
        disabled={!name.trim() || isSaving}
        onClick={() => onSave(name)}
      >
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function TypeManagerClient({
  items: initialItems,
  label,
  description,
  onCreate,
  onUpdate,
  onDelete,
}: {
  items: TypeItem[];
  label: string;
  description: string;
  onCreate: (name: string) => Promise<HotelFormState>;
  onUpdate: (id: number, name: string) => Promise<HotelFormState>;
  onDelete: (id: number) => Promise<HotelFormState>;
}) {
  const [items, setItems]     = useState<TypeItem[]>(initialItems);
  const [editId, setEditId]   = useState<number | null>(null);
  const [adding, setAdding]   = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const addInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await onCreate(newName);
      if (result.success) {
        toast.success(result.message);
        setItems((prev) => [
          ...prev,
          { id: Date.now(), name: newName.trim() },
        ].sort((a, b) => a.name.localeCompare(b.name)));
        setNewName("");
        setAdding(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleUpdate(id: number, name: string) {
    startTransition(async () => {
      const result = await onUpdate(id, name);
      if (result.success) {
        toast.success(result.message);
        setItems((prev) =>
          prev
            .map((item) => (item.id === id ? { ...item, name: name.trim() } : item))
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
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm font-semibold px-2.5">
            {items.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        {/* List */}
        {items.map((item) =>
          editId === item.id ? (
            <EditRow
              key={item.id}
              item={item}
              onSave={(name) => handleUpdate(item.id, name)}
              onCancel={() => setEditId(null)}
              isSaving={isPending}
            />
          ) : (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg px-3 bg-dashboard-base-200 py-2 hover:bg-muted/50 group transition-colors"
            >
              <span className="text-sm font-medium">{item.name}</span>
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
            No {label.toLowerCase()} yet — click "Add" to create one.
          </p>
        )}

        {/* Add row */}
        {adding ? (
          <div className="flex items-center gap-2 pt-2">
            <Input
              ref={addInputRef}
              placeholder={`e.g. ${label === "Meal Types" ? "Breakfast" : "Vegetarian"}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
              className="h-8 text-sm max-w-xs"
              autoFocus
            />
            <Button
              type="button"
              size="icon"
              className="h-8 w-8"
              disabled={!newName.trim() || isPending}
              onClick={handleAdd}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => { setAdding(false); setNewName(""); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="border-dashed w-full bg-dashboard-primary hover:bg-dashboard-primary text-dashboard-base-100 hover:text-dashboard-base-100 py-6"
              onClick={() => setAdding(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add {label.replace(" Types", " Type")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
