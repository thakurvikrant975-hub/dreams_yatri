"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Button }                   from "../../../components/ui/button";
import { Input }                    from "../../../components/ui/input";
import { Badge }                    from "../../../components/ui/badge";
import { OPTIONAL_HOTEL_CATEGORIES } from "@/app/lib/hotelImageCategories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { ImagePickerWithCrop, type PickedImage } from "../../../components/dashboard/ImagePickerWithCrop";
import {
  Star, Trash2, Loader2, Plus, X,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast }  from "sonner";
import { cn } from "@/app/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  addHotelImages,
  deleteHotelImage,
  setPrimaryImage,
  createImageCategory,
  deleteImageCategory,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type DBImage = {
  id:          number;
  url:         string;
  thumbnail:   string | null;
  alt:         string | null;
  sort_order:  number;
  is_primary:  boolean;
  category_id: number;
};

type DBCategory = {
  id:              number;
  name:            string;
  is_required:     boolean;
  is_system:       boolean;
  room_pricing_id: number | null;
  room_pricing:    { id: number } | null;
  images:          DBImage[];
};

// ── Single Image Thumb ────────────────────────────────────────────────────

function ImageThumb({
  image,
  hotel_id,
  onDelete,
  onSetPrimary,
}: {
  image:        DBImage;
  hotel_id:     number;
  onDelete:     () => void;
  onSetPrimary: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

  return (
    <div
      className={cn(
        "group relative aspect-square rounded-xl overflow-hidden border-2 bg-dashboard-base-200",
        image.is_primary ? "border-dashboard-primary" : "border-dashboard-base-content/20 hover:border-dashboard-base-content/40",
      )}
    >
      <img src={`${base}/${image.url}`} alt={image.alt ?? "Hotel image"} className="w-full h-full object-cover" />

      {image.is_primary && (
        <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0 pointer-events-none bg-dashboard-primary text-dashboard-primary-content">
          <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
        </Badge>
      )}

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
        {!image.is_primary && (
          <Button type="button" size="sm" variant="secondary" className="text-[10px] h-6 px-2 cursor-pointer"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              const r = await setPrimaryImage(image.id, hotel_id);
              if (r.success) { toast.success(r.message); onSetPrimary(); }
              else toast.error(r.message);
            })}>
            <Star className="h-2.5 w-2.5 mr-1" /> Set Primary
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm"
              className="text-[10px] h-6 px-2 bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
              <Trash2 className="h-2.5 w-2.5 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete the image from R2 storage too.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => startTransition(async () => {
                  const r = await deleteHotelImage(image.id, hotel_id, image.url, image.thumbnail ?? undefined);
                  if (r.success) { toast.success(r.message); onDelete(); }
                  else toast.error(r.message);
                })}
                className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Category Block ────────────────────────────────────────────────────────

function CategoryBlock({
  category,
  hotel_id,
  onUpdate,
  onRemove,
}: {
  category: DBCategory;
  hotel_id: number;
  onUpdate: (updatedImages: DBImage[], categoryId: number) => void;
  onRemove: (categoryId: number) => void;
}) {
  const [images,    setImages]    = useState<DBImage[]>(category.images);
  const [newPicks,  setNewPicks]  = useState<PickedImage[]>([]);
  const [expanded,  setExpanded]  = useState(true);
  const [isPending, startTransition] = useTransition();

  const missingRequired = category.is_required && images.length === 0;

  // Auto-save: fire once all staged uploads finish
  const autoSaveRef = useRef(false);
  useEffect(() => {
    if (newPicks.length === 0) { autoSaveRef.current = false; return; }
    if (newPicks.some(p => p.status === "uploading")) return;
    const uploaded = newPicks.filter(p => p.status === "uploaded" && p.key);
    if (uploaded.length === 0) return;
    if (autoSaveRef.current) return;
    autoSaveRef.current = true;
    startTransition(async () => {
      const result = await addHotelImages(
        hotel_id,
        category.id,
        uploaded.map(p => ({ url: p.key!, thumbnail: p.key, alt: p.name }))
      );
      if (result.success) {
        toast.success(result.message);
        setNewPicks([]);
        const added: DBImage[] = uploaded.map((p, i) => ({
          id:          Date.now() + i,
          url:         p.key!,
          thumbnail:   p.key ?? null,
          alt:         p.name,
          sort_order:  images.length + i,
          is_primary:  images.length === 0 && i === 0,
          category_id: category.id,
        }));
        const updated = [...images, ...added];
        setImages(updated);
        onUpdate(updated, category.id);
      } else {
        toast.error(result.message);
        autoSaveRef.current = false;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPicks]);

  function handleImageDelete(id: number) {
    const updated = images.filter(img => img.id !== id);
    setImages(updated);
    onUpdate(updated, category.id);
  }

  function handleSetPrimary(id: number) {
    const updated = images.map(img => ({ ...img, is_primary: img.id === id }));
    setImages(updated);
    onUpdate(updated, category.id);
  }


  return (
    <div className={cn(
      "border rounded-xl overflow-hidden bg-dashboard-base-100",
      missingRequired ? "border-dashboard-error/40 bg-dashboard-error/5" : "border-dashboard-base-content/20"
    )}>
      <div className="px-4 py-3 border-b border-dashboard-base-content/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setExpanded(p => !p)}
              className="flex items-center gap-2 cursor-pointer">
              {expanded
                ? <ChevronUp className="h-4 w-4 text-dashboard-base-content/40" />
                : <ChevronDown className="h-4 w-4 text-dashboard-base-content/40" />}
              <span className="text-sm font-semibold text-dashboard-base-content">{category.name}</span>
            </button>

            {category.is_required && (
              <Badge className="text-[10px] border border-dashboard-error/50 text-dashboard-error bg-dashboard-error/10">Required</Badge>
            )}
            {category.room_pricing_id && (
              <Badge className="text-[10px] bg-dashboard-base-200 text-dashboard-base-content/60 border border-dashboard-base-content/20">Room</Badge>
            )}
            {category.is_required && (
              missingRequired
                ? <AlertTriangle className="h-4 w-4 text-dashboard-error" />
                : <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
            )}
            <span className="text-xs text-dashboard-base-content/50">
              {images.length} photo{images.length !== 1 ? "s" : ""}
            </span>
          </div>

          {!category.is_system && !category.is_required && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon"
                  className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete <span className="font-semibold">{category.name}</span> and all its images? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const r = await deleteImageCategory(category.id, hotel_id);
                      if (r.success) { toast.success(r.message); onRemove(category.id); }
                      else toast.error(r.message);
                    }}
                    className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                    Delete Category
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {missingRequired && (
          <p className="text-xs text-dashboard-error mt-1">At least 1 image required for this category</p>
        )}
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {images.sort((a, b) => a.sort_order - b.sort_order).map(img => (
                <ImageThumb key={img.id} image={img} hotel_id={hotel_id}
                  onDelete={() => handleImageDelete(img.id)} onSetPrimary={() => handleSetPrimary(img.id)} />
              ))}
            </div>
          )}

          <ImagePickerWithCrop
            folder="hotels"
            value={newPicks}
            onChange={setNewPicks}
            crop={{ width: 1200, height: 800, label: "1200 × 800" }}
            maxFiles={10}
            label={`Add ${category.name} Photos`}
            hint="JPG, PNG, WebP · Each image opens the crop tool"
          />

          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/50 justify-end">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving photos…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ImagesTab ─────────────────────────────────────────────────────────

export function ImagesTab({
  hotel_id,
  categories: initialCategories,
}: {
  hotel_id:   number;
  categories: DBCategory[];
}) {
  const [categories, setCategories] = useState<DBCategory[]>(initialCategories);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [isPending,  startTransition] = useTransition();

  function handleCategoryUpdate(updatedImages: DBImage[], categoryId: number) {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId ? { ...cat, images: updatedImages } : cat
      )
    );
  }

  function handleCategoryRemove(categoryId: number) {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
  }

  function handleAddCategory(name = newCatName) {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createImageCategory(hotel_id, trimmed);
      if (result.success) {
        toast.success(result.message);
        setNewCatName("");
        setShowNewCat(false);
        setCategories(prev => [...prev, {
          id:              result.id!,
          name:            trimmed,
          is_required:     false,
          is_system:       false,
          room_pricing_id: null,
          room_pricing:    null,
          images:          [],
        }]);
      } else {
        toast.error(result.message);
      }
    });
  }

  const requiredCategories = categories.filter(c => c.is_required);
  const hotelCategories    = categories.filter(c => !c.is_required && !c.room_pricing_id && !c.is_system);
  const roomCategories     = categories.filter(c => c.room_pricing_id !== null);

  const existingCustomNames = new Set(hotelCategories.map(c => c.name));
  const categorySuggestions = OPTIONAL_HOTEL_CATEGORIES
    .map(c => c.name)
    .filter(name => !existingCustomNames.has(name));
  const missingRequired    = requiredCategories.filter(c => c.images.length === 0);

  return (
    <div className="space-y-6 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">

      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 bg-dashboard-error/10 border border-dashboard-error/20 rounded-xl px-3 py-2.5 text-sm text-dashboard-error">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Missing required images in: <strong>{missingRequired.map(c => c.name).join(", ")}</strong></span>
        </div>
      )}

      {requiredCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-dashboard-base-content/50 uppercase tracking-widest">Required</h3>
          {requiredCategories.map(cat => (
            <CategoryBlock key={cat.id} category={cat} hotel_id={hotel_id}
              onUpdate={handleCategoryUpdate} onRemove={handleCategoryRemove} />
          ))}
        </div>
      )}

      {roomCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-dashboard-base-content/50 uppercase tracking-widest">Room Photos</h3>
          {roomCategories.map(cat => (
            <CategoryBlock key={cat.id} category={cat} hotel_id={hotel_id}
              onUpdate={handleCategoryUpdate} onRemove={handleCategoryRemove} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-dashboard-base-content/50 uppercase tracking-widest">Custom Categories</h3>

        {hotelCategories.map(cat => (
          <CategoryBlock key={cat.id} category={cat} hotel_id={hotel_id}
            onUpdate={handleCategoryUpdate} onRemove={handleCategoryRemove} />
        ))}

        {showNewCat ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input placeholder="e.g. Rooftop, Game Room, Conference Hall"
                value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                autoFocus maxLength={60}
                className="max-w-xs bg-dashboard-base-100 border-dashboard-base-content/20" />
              <Button type="button" size="sm" onClick={() => handleAddCategory()}
                disabled={!newCatName.trim() || isPending}
                className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer">
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </Button>
              <Button type="button" size="sm" variant="ghost"
                className="text-dashboard-base-content/60 hover:bg-dashboard-base-300 cursor-pointer"
                onClick={() => { setShowNewCat(false); setNewCatName(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {categorySuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-dashboard-base-content/40 self-center">Suggestions:</span>
                {categorySuggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddCategory(name)}
                    disabled={isPending}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-dashboard-base-content/20 bg-dashboard-base-200 text-dashboard-base-content/60 hover:bg-dashboard-primary/10 hover:text-dashboard-primary hover:border-dashboard-primary/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm"
            className="border-dashed border-dashboard-base-content/30 text-dashboard-base-content/60 hover:bg-dashboard-base-200 hover:text-dashboard-base-content cursor-pointer"
            onClick={() => setShowNewCat(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Custom Category
          </Button>
        )}
      </div>
    </div>
  );
}