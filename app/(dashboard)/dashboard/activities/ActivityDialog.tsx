"use client";

import { useActionState, useEffect, useState } from "react";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch }   from "../components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast }   from "sonner";
import { createActivity, updateActivity, type ActivityFormState } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string; region: { name: string } };

type ActivityItem = {
  id:                number;
  name:              string;
  slug:              string;
  description:       string | null;
  meta_title:        string | null;
  meta_desc:         string | null;
  category:          string | null;
  difficulty:        string | null;
  duration_hours:    number | null;   // ← was unknown
  price:             number | null;   // ← was unknown
  original_price:    number | null;   // ← was unknown
  margin_percentage: number;          // ← was unknown
  pricing_type:      string | null;
  min_persons:       number | null;
  max_persons:       number | null;
  is_active:         boolean;
  created_at:        Date;
  destination:       { id: number; name: string };
  _count:            { images: number; packages: number };
};
const DIFFICULTIES = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];
const CATEGORIES   = ["Adventure", "Cultural", "Wildlife", "Water", "Trekking", "Sightseeing", "Food", "Shopping", "Spiritual", "Other"];
const PRICING_TYPES = [
  { value: "per_person",  label: "Per Person" },
  { value: "flat",        label: "Flat Rate" },
  { value: "per_vehicle", label: "Per Vehicle" },
];

// ── Shared form fields ────────────────────────────────────────────────────

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Create Dialog ─────────────────────────────────────────────────────────

export function CreateActivityDialog({
  destinations,
}: {
  destinations: Destination[];
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");

  const [state, formAction, isPending] = useActionState(
    createActivity,
    { success: false, message: "" }
  );

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      setOpen(false);
    } else if (state.message && !state.success && Object.keys(state.errors ?? {}).length === 0) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Activity</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>

          <form action={formAction} className="space-y-0">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              {/* ── Basic ─────────────────────────────────────────────── */}
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input
                      name="name"
                      placeholder="Valley of Flowers Trek"
                      onChange={e => setSlug(slugify(e.target.value))}
                      required
                    />
                    {state.errors?.name && (
                      <p className="text-xs text-destructive">{state.errors.name[0]}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug <span className="text-destructive">*</span></Label>
                    <Input
                      name="slug"
                      value={slug}
                      onChange={e => setSlug(e.target.value)}
                      placeholder="valley-of-flowers-trek"
                    />
                    {state.errors?.slug && (
                      <p className="text-xs text-destructive">{state.errors.slug[0]}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Destination <span className="text-destructive">*</span></Label>
                    <Select name="destination_id" required>
                      <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                      <SelectContent>
                        {destinations.map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                            <span className="text-muted-foreground text-xs ml-1">({d.region.name})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select name="category">
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Difficulty</Label>
                    <Select name="difficulty">
                      <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration (hours)</Label>
                    <Input name="duration_hours" type="number" min="0" step="0.5" placeholder="4.5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea name="description" rows={4} placeholder="Brief description of the activity..." />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Show on Dreams Yatri website</p>
                  </div>
                  <Switch name="is_active" value="true" defaultChecked />
                </div>
              </TabsContent>

              {/* ── Pricing ───────────────────────────────────────────── */}
              <TabsContent value="pricing" className="space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label>Pricing Type</Label>
                  <Select name="pricing_type">
                    <SelectTrigger><SelectValue placeholder="How is this priced?" /></SelectTrigger>
                    <SelectContent>
                      {PRICING_TYPES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Price (₹)</Label>
                    <Input name="price" type="number" min="0" step="0.01" placeholder="2500" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Original Price (₹)</Label>
                    <Input name="original_price" type="number" min="0" step="0.01" placeholder="3000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Margin %</Label>
                    <Input name="margin_percentage" type="number" min="0" max="100" step="0.01" placeholder="0" defaultValue="0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Min Persons</Label>
                    <Input name="min_persons" type="number" min="1" placeholder="1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Persons</Label>
                    <Input name="max_persons" type="number" min="1" placeholder="20" />
                  </div>
                </div>
              </TabsContent>

              {/* ── SEO ──────────────────────────────────────────────── */}
              <TabsContent value="seo" className="space-y-4 mt-0">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Meta Title</Label>
                  </div>
                  <Input name="meta_title" placeholder="Valley of Flowers Trek | Dreams Yatri" />
                </div>
                <div className="space-y-1.5">
                  <Label>Meta Description</Label>
                  <Textarea name="meta_desc" rows={3} placeholder="A stunning high-altitude trek..." />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Edit Dialog ───────────────────────────────────────────────────────────

export function EditActivityDialog({
  activity,
  destinations,
  open,
  onOpenChange,
}: {
  activity:     ActivityItem;
  destinations: Destination[];
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const boundAction = updateActivity.bind(null, activity.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    { success: false, message: "" }
  );

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state.message && !state.success && Object.keys(state.errors ?? {}).length === 0) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-0">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input name="name" defaultValue={activity.name} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input
                    name="slug"
                    defaultValue={activity.slug}
                    readOnly
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Cannot change after creation</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Destination</Label>
                  <Select name="destination_id" defaultValue={String(activity.destination.id)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {destinations.map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                          <span className="text-muted-foreground text-xs ml-1">({d.region.name})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select name="category" defaultValue={activity.category ?? ""}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select name="difficulty" defaultValue={activity.difficulty ?? ""}>
                    <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (hours)</Label>
                  <Input
                    name="duration_hours"
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={activity.duration_hours ?? ""}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea name="description" rows={4} defaultValue={activity.description ?? ""} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Show on Dreams Yatri website</p>
                </div>
                <Switch name="is_active" value="true" defaultChecked={activity.is_active} />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label>Pricing Type</Label>
                <Select name="pricing_type" defaultValue={activity.pricing_type ?? ""}>
                  <SelectTrigger><SelectValue placeholder="How is this priced?" /></SelectTrigger>
                  <SelectContent>
                    {PRICING_TYPES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Price (₹)</Label>
                  <Input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={activity.price ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Original Price (₹)</Label>
                  <Input
                    name="original_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={activity.original_price ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Margin %</Label>
                  <Input
                    name="margin_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={activity.margin_percentage}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Min Persons</Label>
                  <Input name="min_persons" type="number" min="1" defaultValue={activity.min_persons ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Persons</Label>
                  <Input name="max_persons" type="number" min="1" defaultValue={activity.max_persons ?? ""} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label>Meta Title</Label>
                <Input name="meta_title" defaultValue={activity.meta_title ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Meta Description</Label>
                <Textarea name="meta_desc" rows={3} defaultValue={activity.meta_desc ?? ""} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}