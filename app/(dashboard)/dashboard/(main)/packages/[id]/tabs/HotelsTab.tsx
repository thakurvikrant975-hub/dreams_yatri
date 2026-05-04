"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Plus, X, Loader2, Hotel } from "lucide-react";
import { toast } from "sonner";
import {
  createStayCategoryAction,
  updateStayCategoryAction,
} from "@/app/actions/packages/package.actions";
import type { PackageStayCategory } from "@/app/types/packages";

type Props = {
  packageId: number;
  categories: PackageStayCategory[];
};

type FormState = {
  label: string;
  slug: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
};

const EMPTY: FormState = {
  label: "",
  slug: "",
  description: "",
  is_default: false,
  is_active: true,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function HotelsTab({ packageId, categories: init }: Props) {
  const [categories, setCategories] = useState(init);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleLabelChange(val: string) {
    setForm(f => ({ ...f, label: val, slug: slugEdited ? f.slug : slugify(val) }));
  }

  function openNew() {
    setForm(EMPTY);
    setSlugEdited(false);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(cat: PackageStayCategory) {
    setForm({
      label: cat.label,
      slug: cat.slug,
      description: cat.description ?? "",
      is_default: cat.is_default,
      is_active: cat.is_active,
    });
    setSlugEdited(true);
    setEditingId(cat.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.label.trim()) return toast.error("Label is required");
    if (!form.slug.trim()) return toast.error("Slug is required");

    startTransition(async () => {
      if (editingId) {
        const res = await updateStayCategoryAction(editingId, packageId, {
          label: form.label,
          slug: form.slug,
          description: form.description || undefined,
          is_default: form.is_default,
          is_active: form.is_active,
        });
        if (res.success) {
          toast.success("Stay category updated");
          setCategories(cats => cats.map(c => c.id === editingId
            ? { ...c, ...form, description: form.description || null, updated_at: new Date() }
            : (form.is_default ? { ...c, is_default: false } : c)
          ));
          setShowForm(false);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createStayCategoryAction({
          package_id: packageId,
          label: form.label,
          slug: form.slug,
          description: form.description || undefined,
          is_default: form.is_default,
          is_active: form.is_active,
          sort_order: categories.length,
        });
        if (res.success) {
          toast.success("Stay category added");
          setCategories(cats => [
            ...(form.is_default ? cats.map(c => ({ ...c, is_default: false })) : cats),
            {
              id: res.data.id,
              package_id: packageId,
              label: form.label,
              slug: form.slug,
              description: form.description || null,
              is_default: form.is_default,
              is_active: form.is_active,
              sort_order: cats.length,
              min_duration_days: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ]);
          setShowForm(false);
        } else {
          toast.error(res.error);
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Stay Categories</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Hotel tiers for this package (e.g. Budget, Standard, Deluxe)
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 && !showForm && (
            <div className="flex flex-col items-center py-10 text-center">
              <Hotel className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No stay categories yet</p>
              <p className="text-xs text-muted-foreground">
                Categories define hotel tiers. Add at least one before building itineraries.
              </p>
            </div>
          )}

          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{cat.label}</p>
                    {cat.is_default && <Badge variant="default" className="text-xs">Default</Badge>}
                    {!cat.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{cat.slug}</p>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(cat)}>Edit</Button>
            </div>
          ))}

          {showForm && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">{editingId ? "Edit Stay Category" : "New Stay Category"}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={form.label}
                    onChange={e => handleLabelChange(e.target.value)}
                    placeholder="e.g. Standard"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slug</Label>
                  <Input
                    value={form.slug}
                    onChange={e => { setForm(f => ({ ...f, slug: e.target.value })); setSlugEdited(true); }}
                    placeholder="standard"
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
                  <Label className="text-sm">Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {editingId ? "Update" : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
