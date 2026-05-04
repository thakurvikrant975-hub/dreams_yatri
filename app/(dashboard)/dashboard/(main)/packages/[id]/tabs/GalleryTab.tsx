"use client";

import { useState, useEffect, useTransition } from "react";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { toast } from "sonner";
import {
  getPackageGalleryAction,
  upsertGalleryImageAction,
  removeGalleryImageAction,
} from "@/app/actions/packages/gallery.actions";

type GallerySlot = {
  position: number;
  image_url: string | null;
  label: string | null;
  source_type: "PACKAGE" | "HOTEL" | "ROOM" | "ACTIVITY";
};

type SlotPickerState = {
  picked: PickedImage[];
  label: string;
};

const POSITIONS = [1, 2, 3, 4, 5] as const;

const SLOT_LABELS: Record<number, string> = {
  1: "Cover Image (large)",
  2: "Grid Photo 2",
  3: "Grid Photo 3",
  4: "Grid Photo 4",
  5: "Grid Photo 5",
};

export function GalleryTab({ packageId }: { packageId: number }) {
  const [slots, setSlots] = useState<Map<number, GallerySlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pickers, setPickers] = useState<Record<number, SlotPickerState>>(() =>
    Object.fromEntries(POSITIONS.map(p => [p, { picked: [], label: "" }]))
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getPackageGalleryAction(packageId).then(res => {
      if (res.success) {
        const map = new Map<number, GallerySlot>();
        res.data.forEach(row => {
          map.set(row.position, {
            position: row.position,
            image_url: row.image_url,
            label: row.label,
            source_type: row.source_type as GallerySlot["source_type"],
          });
        });
        setSlots(map);
      }
      setLoading(false);
    });
  }, [packageId]);

  function updatePicker(position: number, update: Partial<SlotPickerState>) {
    setPickers(prev => ({
      ...prev,
      [position]: { ...prev[position], ...update },
    }));
  }

  function handlePickerChange(position: number, imgs: PickedImage[]) {
    updatePicker(position, { picked: imgs });
    const uploaded = imgs.find(img => img.status === "uploaded");
    if (uploaded) {
      saveSlot(position, uploaded.url, pickers[position].label);
    }
  }

  function saveSlot(position: number, imageUrl: string, label: string) {
    startTransition(async () => {
      const res = await upsertGalleryImageAction({
        package_id: packageId,
        image_url: imageUrl,
        source_type: "PACKAGE",
        position,
        label: label || undefined,
      });
      if (res.success) {
        setSlots(prev => {
          const next = new Map(prev);
          next.set(position, {
            position,
            image_url: imageUrl,
            label: label || null,
            source_type: "PACKAGE",
          });
          return next;
        });
        updatePicker(position, { picked: [] });
        toast.success(`Position ${position} saved`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function removeSlot(position: number) {
    startTransition(async () => {
      const res = await removeGalleryImageAction(packageId, position);
      if (res.success) {
        setSlots(prev => {
          const next = new Map(prev);
          next.delete(position);
          return next;
        });
        toast.success(`Position ${position} cleared`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function updateSlotLabel(position: number, label: string) {
    updatePicker(position, { label });
    const slot = slots.get(position);
    if (slot?.image_url) {
      saveSlot(position, slot.image_url, label);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {POSITIONS.map(p => (
          <div key={p} className="h-48 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Curated Gallery</CardTitle>
          <p className="text-sm text-muted-foreground">
            5 positions: 1 large cover + 4 grid photos. Shown on the package detail page.
          </p>
        </CardHeader>
        <CardContent>
          {/* Visual preview layout */}
          <div className="grid grid-cols-3 grid-rows-2 gap-2 mb-6 aspect-[16/9] max-h-64">
            {/* Position 1 spans 2 rows */}
            <div className="row-span-2 rounded-lg overflow-hidden border bg-muted/30 relative group">
              {slots.get(1)?.image_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slots.get(1)!.image_url!}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm" variant="destructive"
                      onClick={() => removeSlot(1)}
                      disabled={pending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Cover</div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs">Cover</span>
                </div>
              )}
            </div>
            {/* Positions 2–5 */}
            {[2, 3, 4, 5].map(pos => (
              <div key={pos} className="rounded-lg overflow-hidden border bg-muted/30 relative group">
                {slots.get(pos)?.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slots.get(pos)!.image_url!}
                      alt={`Position ${pos}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm" variant="destructive"
                        onClick={() => removeSlot(pos)}
                        disabled={pending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{pos}</div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-[10px]">{pos}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Per-position editors */}
          <div className="space-y-4">
            {POSITIONS.map(position => (
              <div key={position} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Position {position} — {SLOT_LABELS[position]}
                  </p>
                  {slots.get(position)?.image_url && (
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive h-7 text-xs"
                      onClick={() => removeSlot(position)}
                      disabled={pending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>

                {slots.get(position)?.image_url ? (
                  <div className="space-y-2">
                    <div className="h-24 rounded-md overflow-hidden border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slots.get(position)!.image_url!}
                        alt={`Position ${position}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label (optional)</Label>
                      <Input
                        className="h-7 text-sm"
                        placeholder="e.g. Mountain View, Lobby..."
                        defaultValue={slots.get(position)?.label ?? ""}
                        onBlur={e => updateSlotLabel(position, e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      To replace, upload a new image below.
                    </p>
                    <ImagePicker
                      folder="packages"
                      value={pickers[position].picked}
                      onChange={imgs => handlePickerChange(position, imgs)}
                      maxFiles={1}
                      label="Replace Image"
                      hint="Upload to replace current"
                    />
                  </div>
                ) : (
                  <ImagePicker
                    folder="packages"
                    value={pickers[position].picked}
                    onChange={imgs => handlePickerChange(position, imgs)}
                    maxFiles={1}
                    label="Upload Image"
                    hint="JPG, PNG, WebP"
                  />
                )}

                {pending && pickers[position].picked.some(img => img.status === "uploading") && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
