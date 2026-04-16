"use client";

import { useState, useTransition } from "react";
import { Star, Trash2, Loader2, ImageIcon } from "lucide-react";
import { Button }   from "../../../components/ui/button";
import { Badge }    from "../../../components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  addPackageImages,
  deletePackageImage,
  setPrimaryPackageImage,
} from "../../actions";

type PkgImage = {
  id:         number;
  url:        string;
  thumbnail:  string | null;
  is_primary: boolean;
  sort_order: number;
};

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

function ImageThumb({
  image,
  package_id,
  onDelete,
  onSetPrimary,
}: {
  image:        PkgImage;
  package_id:   number;
  onDelete:     () => void;
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

export function ImagesTab({
  package_id,
  images: initialImages,
}: {
  package_id: number;
  images:     PkgImage[];
}) {
  const [images,    setImages]    = useState(initialImages);
  const [newPicks,  setNewPicks]  = useState<PickedImage[]>([]);
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
          id:         Date.now() + i,
          url:        p.key!,
          thumbnail:  p.key ?? null,
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
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