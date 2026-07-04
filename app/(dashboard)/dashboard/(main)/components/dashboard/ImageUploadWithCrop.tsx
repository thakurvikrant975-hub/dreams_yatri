"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Slider } from "radix-ui";
import {
  ImageIcon, X, Loader2, CheckCircle2, Upload,
  ZoomIn, ZoomOut, Crop, RotateCcw, RotateCw,
  Sun, Droplets, Wand2, SlidersHorizontal, Zap,
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

export type CropConfig = {
  width: number;
  height: number;
  label?: string;
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

type Adjustments = {
  brightness: number;  // 50-200, default 100
  contrast:   number;  // 50-200, default 100
  saturation: number;  // 0-200,  default 100
  sharpness:  number;  // 0-10,   default 0
};

// ── Canvas helpers ────────────────────────────────────────────────────────────

function sharpenCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
) {
  const d    = ctx.getImageData(0, 0, w, h);
  const px   = d.data;
  const src  = new Uint8ClampedArray(px);
  const f    = Math.min(strength, 0.8) * 0.65;
  const kern = [0, -f, 0, -f, 1 + 4 * f, -f, 0, -f, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            v += src[((y + ky) * w + (x + kx)) * 4 + c] * kern[(ky + 1) * 3 + (kx + 1)];
          }
        }
        px[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, v));
      }
    }
  }
  ctx.putImageData(d, 0, 0);
}

async function extractCrop(
  imageSrc:     string,
  pixelCrop:    Area,
  rotation:     number,
  outputWidth:  number,
  outputHeight: number,
  adj:          Adjustments,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img  = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
  });

  // Rotated canvas
  const toRad = (d: number) => (d * Math.PI) / 180;
  const sin = Math.abs(Math.sin(toRad(rotation)));
  const cos = Math.abs(Math.cos(toRad(rotation)));
  const rotW = Math.round(image.width * cos + image.height * sin);
  const rotH = Math.round(image.width * sin + image.height * cos);

  const rotCanvas       = document.createElement("canvas");
  rotCanvas.width       = rotW;
  rotCanvas.height      = rotH;
  const rotCtx          = rotCanvas.getContext("2d")!;
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(toRad(rotation));
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // Output canvas with adjustments
  const canvas    = document.createElement("canvas");
  canvas.width    = outputWidth;
  canvas.height   = outputHeight;
  const ctx       = canvas.getContext("2d")!;

  const hasAdj = adj.brightness !== 100 || adj.contrast !== 100 || adj.saturation !== 100;
  if (hasAdj) {
    ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
  }

  ctx.drawImage(
    rotCanvas,
    pixelCrop.x,     pixelCrop.y,
    pixelCrop.width,  pixelCrop.height,
    0,               0,
    outputWidth,     outputHeight,
  );

  if (adj.sharpness > 0) {
    ctx.filter = "none";
    sharpenCanvas(ctx, outputWidth, outputHeight, adj.sharpness / 10);
  }

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("Canvas crop failed")); return; }
        resolve(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

// ── Compact slider ────────────────────────────────────────────────────────────

function AdjSlider({
  icon, label, value, min, max, step = 1,
  onChange, fmt,
}: {
  icon:     React.ReactNode;
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step?:    number;
  onChange: (v: number) => void;
  fmt?:     (v: number) => string;
}) {
  const display = fmt ? fmt(value) : String(value);
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground w-18 shrink-0">{label}</span>
      <Slider.Root
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="relative flex items-center select-none touch-none w-full h-4"
      >
        <Slider.Track className="bg-muted relative grow rounded-full h-1.5">
          <Slider.Range className="absolute bg-primary rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={label}
          className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </Slider.Root>
      <span className="text-xs text-muted-foreground w-10 text-right shrink-0 tabular-nums">
        {display}
      </span>
    </div>
  );
}

// ── Crop Dialog ───────────────────────────────────────────────────────────────

const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100, sharpness: 0 };

export function CropDialog({
  open,
  imageSrc,
  cropConfig,
  onConfirm,
  onCancel,
  queuePosition,
}: {
  open:           boolean;
  imageSrc:       string;
  cropConfig:     CropConfig;
  onConfirm:      (f: File) => void;
  onCancel:       () => void;
  queuePosition?: { index: number; total: number };
}) {
  const [crop,        setCrop]        = useState<Point>({ x: 0, y: 0 });
  const [zoom,        setZoom]        = useState(1);
  const [rotation,    setRotation]    = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing,  setProcessing]  = useState(false);
  const [adj,         setAdj]         = useState<Adjustments>(DEFAULT_ADJ);
  const [imgSize,     setImgSize]     = useState<{ w: number; h: number } | null>(null);
  const [showAdj,     setShowAdj]     = useState(false);

  const aspect    = cropConfig.width / cropConfig.height;
  const sizeLabel = cropConfig.label ?? `${cropConfig.width} × ${cropConfig.height}`;

  // Load image dimensions (for header display only)
  useEffect(() => {
    if (!imageSrc) return;
    const img  = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src    = imageSrc;
  }, [imageSrc]);

  // Once the Cropper has loaded the image, snap zoom=1 so the image exactly
  // covers the crop area (react-easy-crop: zoom=1 = fill, not natural size).
  // This ensures the correct state regardless of dialog open/image-load ordering.
  function handleMediaLoaded() {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }

  // Reset all state when dialog opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setAdj(DEFAULT_ADJ);
      setProcessing(false);
      setShowAdj(false);
    }
  }, [open]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const file = await extractCrop(
        imageSrc, croppedArea, rotation,
        cropConfig.width, cropConfig.height, adj,
      );
      onConfirm(file);
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAdj(DEFAULT_ADJ);
  }

  function handleEnhance() {
    setAdj({
      brightness: 105,
      contrast:   112,
      saturation: 108,
      sharpness:  4,
    });
  }

  const updAdj = (k: keyof Adjustments) => (v: number) =>
    setAdj((prev) => ({ ...prev, [k]: v }));

  const isAdjChanged =
    adj.brightness !== 100 || adj.contrast !== 100 ||
    adj.saturation !== 100 || adj.sharpness !== 0;

  const filterString =
    `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="max-w-2xl w-full p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <DialogHeader className="px-5 pt-4 pb-0 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Crop className="h-4 w-4 text-primary" />
              Crop &amp; Edit
              {queuePosition && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({queuePosition.index} of {queuePosition.total})
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {imgSize && (
                <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
                  Source: {imgSize.w.toLocaleString()} × {imgSize.h.toLocaleString()} px
                </span>
              )}
              <span className="text-[11px] font-medium bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                Output: {sizeLabel} px
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">
            Drag image to reposition · scroll to zoom · use controls below
          </p>
        </DialogHeader>

        {/* ── Crop canvas ─────────────────────────────────────────────── */}
        <div
          className="relative w-full bg-black/90"
          style={{ height: 460 }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={handleMediaLoaded}
            showGrid
            objectFit="cover"
            style={{
              containerStyle: { borderRadius: 0 },
              mediaStyle: { filter: filterString },
              cropAreaStyle: {
                border: "2px solid hsl(var(--primary))",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
              },
            }}
          />
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="bg-card border-t px-5 py-4 space-y-3.5">

          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
              className="h-7 w-7 rounded-md border bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <Slider.Root
              min={1} max={3} step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <Slider.Track className="bg-muted relative grow rounded-full h-1.5">
                <Slider.Range className="absolute bg-primary rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb
                aria-label="Zoom"
                className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </Slider.Root>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
              className="h-7 w-7 rounded-md border bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-right shrink-0 tabular-nums">
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRotation((r) => Math.max(-180, r - 90))}
              className="h-7 w-7 rounded-md border bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
              title="Rotate -90°"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <Slider.Root
              min={-180} max={180} step={1}
              value={[rotation]}
              onValueChange={([v]) => setRotation(v)}
              className="relative flex items-center select-none touch-none w-full h-5"
            >
              <Slider.Track className="bg-muted relative grow rounded-full h-1.5">
                <Slider.Range className="absolute bg-primary rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb
                aria-label="Rotation"
                className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </Slider.Root>
            <button
              type="button"
              onClick={() => setRotation((r) => Math.min(180, r + 90))}
              className="h-7 w-7 rounded-md border bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
              title="Rotate +90°"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-right shrink-0 tabular-nums">
              {rotation > 0 ? `+${rotation}` : rotation}°
            </span>
          </div>

          {/* Adjust toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdj((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors",
                showAdj
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-transparent hover:border-border",
              )}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Adjustments
              {isAdjChanged && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleEnhance}
              className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
              title="Auto-enhance: boosts contrast, saturation & sharpness"
            >
              <Wand2 className="h-3 w-3" />
              Enhance
            </button>
          </div>

          {/* Adjustment sliders (collapsible) */}
          {showAdj && (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5 space-y-3">
              <AdjSlider
                icon={<Sun className="h-3.5 w-3.5" />}
                label="Brightness"
                value={adj.brightness} min={50} max={200}
                onChange={updAdj("brightness")}
                fmt={(v) => `${v}%`}
              />
              <AdjSlider
                icon={<span className="text-[11px] font-bold leading-none select-none">◑</span>}
                label="Contrast"
                value={adj.contrast} min={50} max={200}
                onChange={updAdj("contrast")}
                fmt={(v) => `${v}%`}
              />
              <AdjSlider
                icon={<Droplets className="h-3.5 w-3.5" />}
                label="Saturation"
                value={adj.saturation} min={0} max={200}
                onChange={updAdj("saturation")}
                fmt={(v) => `${v}%`}
              />
              <AdjSlider
                icon={<Zap className="h-3.5 w-3.5" />}
                label="Sharpness"
                value={adj.sharpness} min={0} max={10}
                onChange={updAdj("sharpness")}
                fmt={(v) => v === 0 ? "Off" : String(v)}
              />
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset all
            </button>

            <div className="flex items-center gap-2">
              <Button
                type="button" variant="outline" size="sm"
                onClick={onCancel} disabled={processing}
              >
                Cancel
              </Button>
              <Button
                type="button" size="sm"
                onClick={handleConfirm}
                disabled={processing || !croppedArea}
                className="min-w-28"
              >
                {processing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Processing…</>
                ) : (
                  <><Crop className="h-3.5 w-3.5 mr-1.5" />Apply Crop</>
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
  const [pendingSrc,  setPendingSrc]  = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClass = {
    square: "aspect-square",
    video:  "aspect-video",
    wide:   "aspect-[16/6]",
  }[aspectRatio];

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (crop) {
      setPendingSrc(URL.createObjectURL(file));
    } else {
      uploadFile(file);
    }
  }

  function clearPending() {
    if (pendingSrc) URL.revokeObjectURL(pendingSrc);
    setPendingSrc(null);
  }

  async function handleCropConfirm(croppedFile: File) {
    clearPending();
    await uploadFile(croppedFile);
  }

  const isCropping = !!pendingSrc && !!crop;

  return (
    <div className={cn("space-y-1.5", className)}>

      {value?.url ? (
        <div className={cn("relative rounded-xl overflow-hidden bg-muted border", aspectClass)}>
          <img src={value.url} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-white font-medium">Uploaded</span>
          </div>
          {crop && (
            <div className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-1">
              <span className="text-[10px] text-white/80">
                {crop.label ?? `${crop.width} × ${crop.height}`}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute top-2 left-2 h-7 px-2 rounded-full bg-black/60 hover:bg-black/80 flex items-center gap-1 transition-colors"
          >
            <Upload className="h-3 w-3 text-white" />
            <span className="text-[10px] text-white">Change</span>
          </button>
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
                    {crop.label ?? `${crop.width} × ${crop.height} px`} · Crop &amp; edit after selecting
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

      <input type="hidden" name={name} value={value?.key ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileChange}
        className="hidden"
      />

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
