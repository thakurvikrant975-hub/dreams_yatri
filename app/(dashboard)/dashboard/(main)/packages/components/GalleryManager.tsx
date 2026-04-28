"use client";

import { useState, useTransition } from "react";
import { ImagePicker, type PickedImage } from "../../components/dashboard/ImagePicker";
import { Button } from "../../components/ui/button";
import { saveGallery } from "../actions";
import { Loader2, Save } from "lucide-react";

type GalleryRow = {
  id: number;
  image_url: string;
  alt: string | null;
  position: number;
};

type Props = {
  packageId: number;
  initial: GalleryRow[];
};

function galleryRowToPickedImage(row: GalleryRow): PickedImage {
  return {
    id: String(row.id),
    key: row.image_url,
    url: row.image_url,
    name: row.alt ?? `image-${row.position}`,
    size: 0,
    status: "uploaded",
    is_primary: row.position === 1,
  };
}

export function GalleryManager({ packageId, initial }: Props) {
  const [images, setImages] = useState<PickedImage[]>(initial.map(galleryRowToPickedImage));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const uploaded = images.filter((img) => img.status === "uploaded" && img.key);
    startTransition(async () => {
      await saveGallery(
        packageId,
        uploaded.map((img) => ({ key: img.key!, alt: img.name }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <ImagePicker
        folder="packages"
        value={images}
        onChange={setImages}
        maxFiles={5}
        label="Upload Package Images"
        hint="Up to 5 images · JPG, PNG, WebP"
      />

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {images.filter((i) => i.status === "uploaded").length} / 5 images uploaded
        </p>
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-2" />
          )}
          {saved ? "Saved!" : "Save Gallery"}
        </Button>
      </div>
    </div>
  );
}
