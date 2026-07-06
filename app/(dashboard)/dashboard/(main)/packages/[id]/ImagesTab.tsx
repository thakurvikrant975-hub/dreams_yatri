"use client";

import { useState, useEffect, useRef, type DragEvent } from "react";
import { toast } from "sonner";
import { ImagePicker, type PickedImage } from "../../components/dashboard/ImagePicker";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  handleAddImages,
  handleGetPackageImages,
  handleSetPrimaryImage,
  handleReorderImages,
  handleDeleteImage,
} from "@/app/actions/packages/package-image.actions";
import { cn } from "@/app/lib/utils";
import { GripVertical, Star, Trash2, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type DBImage = {
  id: number;
  url: string;
  thumbnail: string | null;
  sort_order: number;
  is_primary: boolean;
};

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function fullUrl(key: string) {
  if (key.startsWith("http")) return key;
  return `${R2_BASE}/${key}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ImagesTab({
  packageId,
  initialImages,
}: {
  packageId: number;
  initialImages: DBImage[];
}) {
  const [staged, setStaged] = useState<PickedImage[]>([]);
  const [dbImages, setDbImages] = useState<DBImage[]>(initialImages);
  const [orderChanged, setOrderChanged] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-save: fire once all staged uploads finish
  const autoSaveRef = useRef(false);
  useEffect(() => {
    if (staged.length === 0) { autoSaveRef.current = false; return; }
    if (staged.some(i => i.status === "uploading")) return;
    const uploaded = staged.filter(i => i.status === "uploaded" && i.key);
    if (uploaded.length === 0) return;
    if (autoSaveRef.current) return;
    autoSaveRef.current = true;
    const urls = uploaded.map(i => i.key!);
    setIsAdding(true);
    handleAddImages(packageId, urls)
      .then(res => {
        if (!res.success) { toast.error(res.message); autoSaveRef.current = false; return; }
        toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} added`);
        setStaged([]);
        setOrderChanged(false);
        return refreshImages();
      })
      .catch(() => { autoSaveRef.current = false; })
      .finally(() => setIsAdding(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged]);

  async function refreshImages() {
    const res = await handleGetPackageImages(packageId);
    if (res.success) setDbImages(res.data as DBImage[]);
  }

async function handleSetPrimary(imageId: number) {
    setIsSettingPrimary(true);
    try {
      const res = await handleSetPrimaryImage(imageId, packageId);
      if (!res.success) { toast.error(res.message); return; }
      setDbImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imageId }))
      );
    } finally {
      setIsSettingPrimary(false);
    }
  }

  async function handleDelete(imageId: number) {
    setIsDeleting(true);
    try {
      const res = await handleDeleteImage(imageId, packageId);
      if (!res.success) { toast.error(res.message); return; }
      toast.success("Image deleted");
      setDbImages((prev) => prev.filter((img) => img.id !== imageId));
      setDeletingId(null);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSaveOrder() {
    const updates = dbImages.map((img, i) => ({ id: img.id, sort_order: i }));
    setIsSavingOrder(true);
    try {
      const res = await handleReorderImages(packageId, updates);
      if (!res.success) { toast.error(res.message); return; }
      toast.success("Order saved");
      setOrderChanged(false);
    } finally {
      setIsSavingOrder(false);
    }
  }

  // ── Drag reorder (DB pool) ─────────────────────────────────────────────

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const arr = [...dbImages];
    const [moved] = arr.splice(dragIndex, 1);
    arr.splice(index, 0, moved);
    setDbImages(arr);
    setDragIndex(index);
    setOrderChanged(true);
  }

  function onDragEnd() {
    setDragIndex(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">

      {/* ── Section 1: Upload Staging ──────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Upload Images</h3>
          <p className="text-xs text-muted-foreground">
            Crop and upload images — they save to the pool automatically.
          </p>
        </div>

        <ImagePicker
          folder="packages"
          value={staged}
          onChange={setStaged}
          maxFiles={20}
          label="Upload package images"
          hint="JPG, PNG, WebP"
        />
        {isAdding && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving to pool…
          </div>
        )}
      </div>

      {/* ── Section 2: Asset Pool ──────────────────────────────────────── */}
      {dbImages.length > 0 ? (
        <>
          <div className="border-t" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Asset Pool</h3>
                <p className="text-xs text-muted-foreground">
                  {dbImages.length} image{dbImages.length !== 1 ? "s" : ""} · Drag to reorder
                </p>
              </div>
              {orderChanged && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSavingOrder}
                  onClick={handleSaveOrder}
                >
                  {isSavingOrder && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Order
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {dbImages.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  className={cn(
                    "group relative rounded-xl overflow-hidden border-2 bg-muted aspect-square transition-all cursor-grab active:cursor-grabbing",
                    img.is_primary ? "border-primary" : "border-border hover:border-muted-foreground/50",
                    dragIndex === index && "opacity-50 scale-95",
                  )}
                >
                  <img
                    src={fullUrl(img.url)}
                    alt={`Package image ${index + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />

                  {/* Top bar (hover) — drag handle + delete */}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-6 w-6 rounded bg-black/60 flex items-center justify-center">
                      <GripVertical className="h-3 w-3 text-white" />
                    </div>

                    <AlertDialog
                      open={deletingId === img.id}
                      onOpenChange={(open) => !open && setDeletingId(null)}
                    >
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setDeletingId(img.id)}
                        className="h-6 w-6 rounded bg-black/60 hover:bg-destructive/80 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete image?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the image from the pool.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(img.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Set primary (hover, bottom) */}
                  {!img.is_primary && (
                    <div className="absolute inset-x-0 bottom-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={isSettingPrimary}
                        onClick={() => handleSetPrimary(img.id)}
                        className="w-full text-[9px] font-medium bg-black/60 hover:bg-primary/80 text-white rounded px-1.5 py-1 transition-colors"
                      >
                        Set primary
                      </button>
                    </div>
                  )}

                  {/* Primary badge */}
                  {img.is_primary && (
                    <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 bg-primary pointer-events-none">
                      <Star className="h-2.5 w-2.5 mr-0.5" />
                      Primary
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed bg-muted/30">
          <p className="text-sm text-muted-foreground">No images in pool yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Upload images above and click &quot;Add to Pool&quot;
          </p>
        </div>
      )}
    </div>
  );
}
