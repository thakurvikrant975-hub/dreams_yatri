"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { ImageIcon, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { toast } from "sonner";
import {
  getPackageImagesAction,
  addPackageImageAction,
  removePackageImageAction,
  setPrimaryPackageImageAction,
} from "@/app/actions/packages/gallery.actions";

type DbImage = {
  id: number;
  url: string;
  thumbnail: string | null;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
};

export function ImagesTab({ packageId }: { packageId: number }) {
  const [images, setImages] = useState<DbImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [staged, setStaged] = useState<PickedImage[]>([]);
  const savedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    getPackageImagesAction(packageId).then(res => {
      if (res.success) setImages(res.data as DbImage[]);
      setLoading(false);
    });
  }, [packageId]);

  function handleStagedChange(imgs: PickedImage[]) {
    setStaged(imgs);
  }

  function saveUploaded() {
    const toSave = staged.filter(
      img => img.status === "uploaded" && img.key && !savedKeys.current.has(img.key)
    );
    if (toSave.length === 0) return toast.error("No uploaded images to add");

    startTransition(async () => {
      for (const img of toSave) {
        const res = await addPackageImageAction({
          package_id: packageId,
          url: img.url,
        });
        if (res.success) {
          savedKeys.current.add(img.key!);
          setImages(prev => [
            ...prev,
            {
              id: res.data.id,
              url: img.url,
              thumbnail: null,
              alt: null,
              sort_order: prev.length,
              is_primary: prev.length === 0,
            },
          ]);
        } else {
          toast.error(`Failed to save: ${img.name}`);
        }
      }
      toast.success(`Added ${toSave.length} image${toSave.length !== 1 ? "s" : ""}`);
      setStaged([]);
      savedKeys.current.clear();
    });
  }

  function handleSetPrimary(imageId: number) {
    startTransition(async () => {
      const res = await setPrimaryPackageImageAction(imageId, packageId);
      if (res.success) {
        setImages(prev => prev.map(img => ({ ...img, is_primary: img.id === imageId })));
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(imageId: number) {
    startTransition(async () => {
      const res = await removePackageImageAction(imageId, packageId);
      if (res.success) {
        setImages(prev => prev.filter(img => img.id !== imageId));
        toast.success("Image removed");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImagePicker
            folder="packages"
            value={staged}
            onChange={handleStagedChange}
            maxFiles={10}
            label="Upload Package Images"
            hint="JPG, PNG, WebP · Multiple allowed"
          />
          {staged.some(img => img.status === "uploaded") && (
            <div className="flex justify-end">
              <Button onClick={saveUploaded} disabled={pending} size="sm">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to Package
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Images */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Package Images
            {images.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {images.length} image{images.length !== 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center border rounded-xl bg-muted/20">
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No images yet</p>
              <p className="text-xs text-muted-foreground">Upload images above to add them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {images.map(img => (
                <div key={img.id} className="group relative rounded-lg overflow-hidden border aspect-[4/3] bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? "Package image"}
                    className="w-full h-full object-cover"
                  />
                  {img.is_primary && (
                    <Badge className="absolute top-2 left-2 text-xs">Primary</Badge>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 gap-1.5">
                    {!img.is_primary && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => handleSetPrimary(img.id)}
                        disabled={pending}
                      >
                        <Star className="h-3.5 w-3.5 mr-1" />
                        Set Primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 ml-auto"
                      onClick={() => handleDelete(img.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
