"use client";

import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Slider } from "radix-ui";
import {
  ImageIcon, X, Loader2, CheckCircle2, Upload,
  ZoomIn, ZoomOut, Crop, RotateCcw,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadedImage = {
  key: string;
  url: string;
};

type CropConfig = {
  width: number;   // output width in px  (e.g. 400)
  height: number;  // output height in px (e.g. 250)
  label?: string;  // optional override, defaults to "400 × 250"
};

type Folder =
  | "regions" | "destinations" | "hotels" | "packages"
  | "activities" | "team-members" | "attractions" | "vehicles"
  | "cab-drivers" | "blogs";

type Props = {
  name: string;
  label?: string;
  value?: UploadedImage | null;
  onChange?: (img: UploadedImage | null) => void;
  folder: Folder;
  aspectRatio?: "square" | "video" | "wide";
  crop?: CropConfig;
  className?: string;
};

// ── Canvas crop helper ────────────────────────────────────────────────────────

async function extractCrop(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number,
  outputHeight: number,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width  = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    outputWidth, outputHeight,
  );

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Canvas crop failed")); return; }
      resolve(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  });
}

// ── Internal Crop Dialog ──────────────────────────────────────────────────────

function CropDialog({
  open,
  imageSrc,
  cropConfig,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  imageSrc: string;
  cropConfig: CropConfig;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop]   = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom]   = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing]   = useState(false);

  const aspect = cropConfig.width / cropConfig.height;
  const sizeLabel = cropConfig.label ?? `${cropConfig.width} × ${cropConfig.height}`;

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const file = await extractCrop(imageSrc, croppedArea, cropConfig.width, cropConfig.height);
      onConfirm(file);
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="max-w-2xl w-full p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Crop className="h-4 w-4 text-primary" />
                Crop Image
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag to reposition · scroll or pinch to zoom
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
              <span className="text-xs font-medium text-muted-foreground">Required size:</span>
              <span className="text-xs font-semibold text-foreground">{sizeLabel} px</span>
            </div>
          </div>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full bg-black/90" style={{ height: 380 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: {
                border: "2px solid hsl(var(--primary))",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-4 bg-card border-t">

          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              className="h-7 w-7 rounded-md border bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <Slider.Root
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <Slider.Track className="bg-muted relative grow rounded-full h-1.5">
                <Slider.Range className="absolute bg-primary rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb
                className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Zoom"
              />
            </Slider.Root>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="h-7 w-7 rounded-md border bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={processing || !croppedArea}
                className="min-w-24"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Crop className="h-3.5 w-3.5 mr-1.5" />
                    Apply Crop
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ImageUploadWithCrop({
  name,
  label = "Upload Image",
  value,
  onChange,
  folder,
  aspectRatio = "video",
  crop,
  className,
}: Props) {
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSrc,  setPendingSrc]  = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClass = {
    square: "aspect-square",
    video:  "aspect-video",
    wide:   "aspect-[16/6]",
  }[aspectRatio];

  // ── Upload helper ─────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);

      const res  = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
      onChange?.({ key: data.key, url: data.url });
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── File selected ─────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = "";
    if (!file) return;

    if (crop) {
      // Show crop dialog first
      setPendingFile(file);
      setPendingSrc(URL.createObjectURL(file));
    } else {
      // Direct upload
      uploadFile(file);
    }
  }

  // ── Crop confirmed ────────────────────────────────────────────────────────

  async function handleCropConfirm(croppedFile: File) {
    clearPending();
    await uploadFile(croppedFile);
  }

  function clearPending() {
    if (pendingSrc) URL.revokeObjectURL(pendingSrc);
    setPendingFile(null);
    setPendingSrc(null);
  }

  const isCropping = !!pendingSrc && !!crop;

  return (
    <div className={cn("space-y-1.5", className)}>

      {value?.url ? (
        <div className={cn("relative rounded-xl overflow-hidden bg-muted border", aspectClass)}>
          <img src={value.url} alt="Preview" className="w-full h-full object-cover" />

          {/* Uploaded badge */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-white font-medium">Uploaded</span>
          </div>

          {/* Crop size badge */}
          {crop && (
            <div className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-1">
              <span className="text-[10px] text-white/80">
                {crop.label ?? `${crop.width} × ${crop.height}`}
              </span>
            </div>
          )}

          {/* Change */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute top-2 left-2 h-7 px-2 rounded-full bg-black/60 hover:bg-black/80 flex items-center gap-1 transition-colors"
          >
            <Upload className="h-3 w-3 text-white" />
            <span className="text-[10px] text-white">Change</span>
          </button>

          {/* Remove */}
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-destructive/80 flex items-center justify-center transition-colors"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full rounded-xl border-2 border-dashed border-border",
            "hover:border-primary/50 hover:bg-primary/5",
            "flex flex-col items-center justify-center gap-2",
            "transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            aspectClass,
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uploading…</span>
            </>
          ) : (
            <>
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                {crop
                  ? <Crop className="h-4 w-4 text-muted-foreground" />
                  : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-medium">{label}</p>
                {crop ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {crop.label ?? `${crop.width} × ${crop.height} px`} · You can crop after selecting
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP up to 20MB</p>
                )}
              </div>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Hidden form input */}
      <input type="hidden" name={name} value={value?.key ?? ""} />

      {/* File picker */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Crop dialog */}
      {isCropping && crop && pendingSrc && (
        <CropDialog
          open
          imageSrc={pendingSrc}
          cropConfig={crop}
          onConfirm={handleCropConfirm}
          onCancel={clearPending}
        />
      )}
    </div>
  );
}
