"use client";

import { GalleryManager } from "../../components/GalleryManager";

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

export function GalleryTab({ packageId, initial }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Gallery</h2>
        <p className="text-sm text-muted-foreground">Upload up to 5 images for this package. Drag to reorder.</p>
      </div>
      <GalleryManager packageId={packageId} initial={initial} />
    </div>
  );
}
