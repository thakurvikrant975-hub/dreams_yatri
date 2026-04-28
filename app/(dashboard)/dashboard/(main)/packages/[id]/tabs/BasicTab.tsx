"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { Plus, X, Loader2, Info, Tag, Search, Star, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  updatePackageBasic,
  updatePackageTags,
  updatePackageCategories, addPackageImages,
  deletePackageImage,
  setPrimaryPackageImage,
} from "../../actions";

import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";

import { cn } from "@/app/lib/utils";

type PkgImage = {
  id: number;
  url: string;
  thumbnail: string | null;
  is_primary: boolean;
  sort_order: number;
};


const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type SelectItem = { id: number; name: string; slug?: string };

// ── Bullet list editor ────────────────────────────────────────────────────

function ListEditor({
  label, items, onChange, placeholder,
}: {
  label: string; items: string[];
  onChange: (items: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            <span className="flex-1 text-sm">{item}</span>
            <button type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="flex-1 text-sm" />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Multi-select chips ─────────────────────────────────────────────────────

function ChipSelect({
  label, all, selectedIds, onChange,
}: {
  label: string; all: SelectItem[];
  selectedIds: number[]; onChange: (ids: number[]) => void;
}) {
  const selected = all.filter(a => selectedIds.includes(a.id));
  const available = all.filter(a => !selectedIds.includes(a.id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[36px] rounded-lg border p-2 bg-background">
        {selected.map(item => (
          <span key={item.id}
            className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            {item.name}
            <button type="button" onClick={() => onChange(selectedIds.filter(id => id !== item.id))}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {available.length > 0 && (
          <Select onValueChange={val => onChange([...selectedIds, Number(val)])}>
            <SelectTrigger className="h-6 w-auto border-0 bg-transparent text-xs text-muted-foreground p-0 focus:ring-0">
              <SelectValue placeholder="+ Add" />
            </SelectTrigger>
            <SelectContent>
              {available.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ── Image field ────────────────────────────────────────────────────────────

function ImageField({
  label, hint, existingKey, picks, onChange,
}: {
  label: string; hint: string;
  existingKey: string | null; picks: PickedImage[];
  onChange: (p: PickedImage[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <ImagePicker folder="packages" value={picks} onChange={onChange}
        maxFiles={1} label={`Upload ${label}`} hint="JPG, PNG, WebP" />

      <p className="text-xs text-muted-foreground">{hint}</p>
      {existingKey && picks.length === 0 && (
        <div className="w-32 h-20 rounded-lg overflow-hidden border mb-2">
          <img src={`${BASE}/${existingKey}`} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

// Multiple Images
function ImageThumb({
  image,
  package_id,
  onDelete,
  onSetPrimary,
}: {
  image: PkgImage;
  package_id: number;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={cn(
      "group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted",
      image.is_primary ? "border-primary" : "border-border hover:border-muted-foreground/40",
    )}>
      <img src={`${BASE}/${image.url}`} alt="Package image" className="w-full h-full object-cover" />

      {image.is_primary && (
        <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0 pointer-events-none bg-primary">
          <Star className="h-2.5 w-2.5 mr-0.5" />Primary
        </Badge>
      )}

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
        {!image.is_primary && (
          <Button type="button" size="sm" variant="secondary" className="text-[10px] h-6 px-2"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              const r = await setPrimaryPackageImage(image.id, package_id);
              if (r.success) { toast.success(r.message); onSetPrimary(); }
              else toast.error(r.message);
            })}>
            <Star className="h-2.5 w-2.5 mr-1" />Set Primary
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="destructive" className="text-[10px] h-6 px-2">
              <Trash2 className="h-2.5 w-2.5 mr-1" />Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image</AlertDialogTitle>
              <AlertDialogDescription>Permanently deletes from R2 storage.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => startTransition(async () => {
                  const r = await deletePackageImage(image.id, package_id, image.url, image.thumbnail ?? undefined);
                  if (r.success) { toast.success(r.message); onDelete(); }
                  else toast.error(r.message);
                })}
                className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ImagesTab({
  package_id,
  images: initialImages,
}: {
  package_id: number;
  images: PkgImage[];
}) {
  const [images, setImages] = useState(initialImages);
  const [newPicks, setNewPicks] = useState<PickedImage[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: number) {
    setImages(prev => prev.filter(img => img.id !== id));
  }

  function handleSetPrimary(id: number) {
    setImages(prev => prev.map(img => ({ ...img, is_primary: img.id === id })));
  }

  function handleSave() {
    const uploaded = newPicks.filter(p => p.status === "uploaded" && p.key);
    if (uploaded.length === 0) { toast.error("Wait for uploads to finish"); return; }

    startTransition(async () => {
      const r = await addPackageImages(
        package_id,
        uploaded.map(p => ({ url: p.key!, thumbnail: p.key })),
      );
      if (r.success) {
        toast.success(r.message);
        setNewPicks([]);
        const added: PkgImage[] = uploaded.map((p, i) => ({
          id: Date.now() + i,
          url: p.key!,
          thumbnail: p.key ?? null,
          is_primary: images.length === 0 && i === 0,
          sort_order: images.length + i,
        }));
        setImages(prev => [...prev, ...added]);
      } else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-6">
      {/* Existing images */}
      {images.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Package Photos</p>
            <span className="text-xs text-muted-foreground">
              {images.length} photo{images.length !== 1 ? "s" : ""} · Hover to manage
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
            {images.sort((a, b) => a.sort_order - b.sort_order).map(img => (
              <ImageThumb
                key={img.id}
                image={img}
                package_id={package_id}
                onDelete={() => handleDelete(img.id)}
                onSetPrimary={() => handleSetPrimary(img.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 border-2 border-dashed rounded-xl">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
        </div>
      )}

      {/* Upload */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Add Photos</p>
        <ImagePicker
          folder="packages"
          value={newPicks}
          onChange={setNewPicks}
          maxFiles={20}
          label="Upload Package Photos"
          hint="JPG, PNG, WebP · First photo becomes primary"
        />
        {newPicks.length > 0 && (
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleSave}
              disabled={isPending || newPicks.some(p => p.status === "uploading")}>
              {isPending
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving...</>
                : <>Save {newPicks.filter(p => p.status === "uploaded").length} Photo{newPicks.length !== 1 ? "s" : ""}</>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function BasicTab({
  pkg,
  destinations,
  categories,
  tags,
  assignedTagIds,
  assignedCategoryIds,
}: {
  pkg: {
    id: number;
    title: string;
    slug: string;
    description: string | null;
    meta_title: string | null;
    meta_desc: string | null;
    thumbnail: string | null;
    cover_image: string | null;
    inclusions: string[];
    exclusions: string[];
    is_active: boolean;
    destination: { id: number; name: string };
    images: PkgImage[];
  };
  destinations: { id: number; name: string; region: { name: string } }[];
  categories: SelectItem[];
  tags: SelectItem[];
  assignedTagIds: number[];
  assignedCategoryIds: number[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(pkg.title);
  const [destinationId, setDestinationId] = useState(String(pkg.destination.id));
  const [description, setDescription] = useState(pkg.description ?? "");
  const [metaTitle, setMetaTitle] = useState(pkg.meta_title ?? "");
  const [metaDesc, setMetaDesc] = useState(pkg.meta_desc ?? "");
  const [isActive, setIsActive] = useState(pkg.is_active);
  const [inclusions, setInclusions] = useState<string[]>(pkg.inclusions);
  const [exclusions, setExclusions] = useState<string[]>(pkg.exclusions);
  const [tagIds, setTagIds] = useState<number[]>(assignedTagIds);
  const [categoryIds, setCategoryIds] = useState<number[]>(assignedCategoryIds);
  const [thumbPicks, setThumbPicks] = useState<PickedImage[]>([]);
  const [coverPicks, setCoverPicks] = useState<PickedImage[]>([]);

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("slug", pkg.slug);
      fd.append("destination_id", destinationId);
      fd.append("description", description);
      fd.append("meta_title", metaTitle);
      fd.append("meta_desc", metaDesc);
      fd.append("is_active", String(isActive));
      fd.append("inclusions", JSON.stringify(inclusions));
      fd.append("exclusions", JSON.stringify(exclusions));
      if (thumbPicks[0]?.key) fd.append("thumbnail", thumbPicks[0].key);
      if (coverPicks[0]?.key) fd.append("cover_image", coverPicks[0].key);

      const [r1, r2, r3] = await Promise.all([
        updatePackageBasic(pkg.id, { success: false, message: "" }, fd),
        updatePackageTags(pkg.id, tagIds),
        updatePackageCategories(pkg.id, categoryIds),
      ]);

      const failed = [r1, r2, r3].find(r => !r.success);
      if (failed) toast.error(failed.message);
      else { toast.success("Changes saved"); router.refresh(); }
    });
  }

  return (
    <div className="space-y-6">

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" /> Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={pkg.slug} readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Cannot change after creation</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Destination</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
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
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={4} placeholder="Package overview..." />
          </div>

          <div >
            <ImageField label="Thumbnail" hint="Listing cards · 400×250"
              existingKey={pkg.thumbnail} picks={thumbPicks} onChange={setThumbPicks} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible on Dreams Yatri</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* Inclusions & Exclusions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Inclusions & Exclusions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <ListEditor label="✓ Inclusions" items={inclusions} onChange={setInclusions}
            placeholder="e.g. Accommodation on twin sharing" />
          <ListEditor label="✗ Exclusions" items={exclusions} onChange={setExclusions}
            placeholder="e.g. Airfare and airport taxes" />
        </CardContent>
      </Card>

      {/* Tags & Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Tags & Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChipSelect label="Tags" all={tags} selectedIds={tagIds} onChange={setTagIds} />
          <ChipSelect label="Categories" all={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ImagesTab package_id={pkg.id} images={pkg.images} />
        </CardContent>
      </Card>


      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}