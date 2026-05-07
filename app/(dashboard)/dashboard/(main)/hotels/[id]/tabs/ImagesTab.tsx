"use client";

import { useState, useTransition }  from "react";
import { Button }                   from "../../../components/ui/button";
import { Input }                    from "../../../components/ui/input";
import { Badge }                    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
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
        "group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted",
        image.is_primary ? "border-primary" : "border-border hover:border-muted-foreground/40",
      )}
    >
      <img
        src={`${base}/${image.url}`}
        alt={image.alt ?? "Hotel image"}
        className="w-full h-full object-cover"
      />

      {/* Primary badge */}
      {image.is_primary && (
        <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0 pointer-events-none bg-primary">
          <Star className="h-2.5 w-2.5 mr-0.5" />
          Primary
        </Badge>
      )}

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
        {!image.is_primary && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-[10px] h-6 px-2"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              const r = await setPrimaryImage(image.id, hotel_id);
              if (r.success) { toast.success(r.message); onSetPrimary(); }
              else toast.error(r.message);
            })}
          >
            <Star className="h-2.5 w-2.5 mr-1" />
            Set Primary
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="destructive" className="text-[10px] h-6 px-2">
              <Trash2 className="h-2.5 w-2.5 mr-1" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the image from R2 storage too.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => startTransition(async () => {
                  const r = await deleteHotelImage(
                    image.id, hotel_id, image.url, image.thumbnail ?? undefined
                  );
                  if (r.success) { toast.success(r.message); onDelete(); }
                  else toast.error(r.message);
                })}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
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

  function handleSaveNew() {
    const uploaded = newPicks.filter(p => p.status === "uploaded" && p.key);
    if (uploaded.length === 0) {
      toast.error("Wait for uploads to finish");
      return;
    }

    startTransition(async () => {
      const result = await addHotelImages(
        hotel_id,
        category.id,
        uploaded.map(p => ({
          url:       p.key!,
          thumbnail: p.key,
          alt:       p.name,
        }))
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
      }
    });
  }

  return (
    <Card className={cn(missingRequired && "border-destructive/50 bg-destructive/5")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Collapse toggle */}
            <button
              type="button"
              onClick={() => setExpanded(p => !p)}
              className="flex items-center gap-2"
            >
              {expanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
              <CardTitle className="text-sm font-semibold">{category.name}</CardTitle>
            </button>

            {category.is_required && (
              <Badge variant="outline" className="text-[10px] border-destructive text-destructive">
                Required
              </Badge>
            )}
            {category.room_pricing_id && (
              <Badge variant="secondary" className="text-[10px]">Room</Badge>
            )}

            {category.is_required && (
              missingRequired
                ? <AlertTriangle className="h-4 w-4 text-destructive" />
                : <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}

            <span className="text-xs text-muted-foreground">
              {images.length} photo{images.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Delete non-system, non-required categories */}
          {!category.is_system && !category.is_required && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete <span className="font-semibold">{category.name}</span> and all its
                    images? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const r = await deleteImageCategory(category.id, hotel_id);
                      if (r.success) {
                        toast.success(r.message);
                        onRemove(category.id);
                      } else {
                        toast.error(r.message);
                      }
                    }}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete Category
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {missingRequired && (
          <p className="text-xs text-destructive mt-1">
            At least 1 image required for this category
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Existing images */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {images
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(img => (
                  <ImageThumb
                    key={img.id}
                    image={img}
                    hotel_id={hotel_id}
                    onDelete={()       => handleImageDelete(img.id)}
                    onSetPrimary={()   => handleSetPrimary(img.id)}
                  />
                ))}
            </div>
          )}

          {/* Upload new images for this category */}
          <ImagePicker
            folder="hotels"
            value={newPicks}
            onChange={setNewPicks}
            maxFiles={10}
            label={`Add ${category.name} Photos`}
            hint="JPG, PNG, WebP"
          />

          {newPicks.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveNew}
                disabled={isPending || newPicks.some(p => p.status === "uploading")}
                className="gap-1.5"
              >
                {isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</>
                  : <>Save {newPicks.filter(p => p.status === "uploaded").length} Photo{newPicks.length !== 1 ? "s" : ""}</>
                }
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
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

  function handleAddCategory() {
    if (!newCatName.trim()) return;
    startTransition(async () => {
      const result = await createImageCategory(hotel_id, newCatName.trim());
      if (result.success) {
        toast.success(result.message);
        setNewCatName("");
        setShowNewCat(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  const requiredCategories = categories.filter(c => c.is_required);
  const hotelCategories    = categories.filter(c => !c.is_required && !c.room_pricing_id);
  const roomCategories     = categories.filter(c => c.room_pricing_id !== null);
  const missingRequired    = requiredCategories.filter(c => c.images.length === 0);

  return (
    <div className="space-y-6">

      {/* Validation summary */}
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Missing required images in:{" "}
            <strong>{missingRequired.map(c => c.name).join(", ")}</strong>
          </span>
        </div>
      )}

      {/* Required categories */}
      {requiredCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Required
          </h3>
          {requiredCategories.map(cat => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              hotel_id={hotel_id}
              onUpdate={handleCategoryUpdate}
              onRemove={handleCategoryRemove}
            />
          ))}
        </div>
      )}

      {/* Optional hotel-level categories */}
      {hotelCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Hotel Areas
          </h3>
          {hotelCategories.map(cat => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              hotel_id={hotel_id}
              onUpdate={handleCategoryUpdate}
              onRemove={handleCategoryRemove}
            />
          ))}
        </div>
      )}

      {/* Room-specific categories */}
      {roomCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Room Photos
          </h3>
          {roomCategories.map(cat => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              hotel_id={hotel_id}
              onUpdate={handleCategoryUpdate}
              onRemove={handleCategoryRemove}
            />
          ))}
        </div>
      )}

      {/* Add custom category */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Custom Categories
        </h3>
        {showNewCat ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. Rooftop, Game Room, Conference Hall"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCategory()}
              autoFocus
              className="max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddCategory}
              disabled={!newCatName.trim() || isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowNewCat(false); setNewCatName(""); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() => setShowNewCat(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Custom Category
          </Button>
        )}
      </div>
    </div>
  );
}