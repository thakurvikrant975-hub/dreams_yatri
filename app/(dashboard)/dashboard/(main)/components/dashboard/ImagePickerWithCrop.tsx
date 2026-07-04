"use client";

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent } from "react";
import { CropDialog, type CropConfig } from "./ImageUploadWithCrop";
import type { PickedImage } from "./ImagePicker";
import { ImageIcon, X, Upload, Loader2, Star, AlertCircle, GripVertical } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/app/lib/utils";

export type { PickedImage };

// ── Types ──────────────────────────────────────────────────────────────────

type CropQueueItem = {
    id:   string;
    file: File;
    src:  string; // blob URL shown in CropDialog
};

type Folder =
    | "regions" | "destinations" | "hotels" | "packages"
    | "activities" | "team-members" | "attractions"
    | "vehicles" | "cab-drivers";

type Props = {
    folder:        Folder;
    value?:        PickedImage[];
    onChange:      (images: PickedImage[]) => void;
    crop:          CropConfig;
    maxFiles?:     number;
    label?:        string;
    hint?:         string;
    className?:    string;
    previewAspect?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];

function uid() { return Math.random().toString(36).slice(2, 10); }

async function uploadFile(file: File, folder: string): Promise<{ key: string; url: string }> {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    const res  = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return { key: data.key, url: data.url };
}

// ── Thumbnail card ─────────────────────────────────────────────────────────

function Thumb({
    image, index, total, previewAspect,
    onRemove, onSetPrimary, onMoveLeft, onMoveRight,
    isDragging, dragHandleProps,
}: {
    image:           PickedImage;
    index:           number;
    total:           number;
    previewAspect:   string;
    onRemove:        () => void;
    onSetPrimary:    () => void;
    onMoveLeft:      () => void;
    onMoveRight:     () => void;
    isDragging?:     boolean;
    dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
    return (
        <div className={cn(
            "group relative rounded-xl overflow-hidden border-2 bg-muted transition-all",
            previewAspect,
            image.is_primary
                ? "border-primary"
                : "border-border hover:border-muted-foreground/50",
            isDragging   && "opacity-50 scale-95",
            image.status === "error" && "border-destructive",
        )}>
            <img src={image.url} alt={image.name} className="w-full h-full object-cover" />

            {/* uploading overlay */}
            {image.status === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                    <span className="text-[10px] text-white font-medium">Uploading</span>
                </div>
            )}

            {/* error overlay */}
            {image.status === "error" && (
                <div className="absolute inset-0 bg-destructive/60 flex flex-col items-center justify-center gap-1 p-2">
                    <AlertCircle className="h-4 w-4 text-white" />
                    <span className="text-[9px] text-white text-center leading-tight">{image.error}</span>
                </div>
            )}

            {/* top bar */}
            {image.status !== "uploading" && (
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                        {...dragHandleProps}
                        className="h-6 w-6 rounded bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="h-3 w-3 text-white" />
                    </div>
                    <button type="button" onClick={onRemove}
                        className="h-6 w-6 rounded bg-black/60 hover:bg-destructive/80 flex items-center justify-center transition-colors">
                        <X className="h-3 w-3 text-white" />
                    </button>
                </div>
            )}

            {/* set primary */}
            {!image.is_primary && image.status === "uploaded" && (
                <div className="absolute inset-x-0 bottom-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={onSetPrimary}
                        className="w-full text-[9px] font-medium bg-black/60 hover:bg-primary/80 text-white rounded px-1.5 py-1 transition-colors">
                        Set primary
                    </button>
                </div>
            )}

            {image.is_primary && (
                <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 bg-primary pointer-events-none">
                    <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
                </Badge>
            )}

            {image.status === "uploaded" && (
                <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}

            {/* move arrows */}
            <div className="absolute inset-x-0 bottom-7 flex justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                    <button type="button" onClick={onMoveLeft}
                        className="h-5 w-5 rounded bg-black/60 text-white text-[10px] flex items-center justify-center">←</button>
                )}
                {index < total - 1 && (
                    <button type="button" onClick={onMoveRight}
                        className="h-5 w-5 rounded bg-black/60 text-white text-[10px] flex items-center justify-center ml-auto">→</button>
                )}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ImagePickerWithCrop({
    folder,
    value = [],
    onChange,
    crop,
    maxFiles   = 10,
    label      = "Upload Images",
    hint,
    className,
    previewAspect,
}: Props) {
    const [cropQueue,  setCropQueue]  = useState<CropQueueItem[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [dragIndex,  setDragIndex]  = useState<number | null>(null);
    const inputRef  = useRef<HTMLInputElement>(null);
    // Keep a ref so async upload callbacks always read latest value/onChange
    const valueRef    = useRef<PickedImage[]>(value);
    const onChangeRef = useRef<(imgs: PickedImage[]) => void>(onChange);
    useEffect(() => { valueRef.current    = value;    }, [value]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    // Derive preview aspect from crop config if not explicitly passed
    const thumbAspect = previewAspect ?? (() => {
        const r = crop.width / crop.height;
        if (r >= 3)   return "aspect-[16/5]";
        if (r >= 1.4) return "aspect-video";
        return "aspect-square";
    })();

    const canAddMore = value.length + cropQueue.length < maxFiles;

    // ── Queue files for cropping ─────────────────────────────────────────

    const queueFiles = useCallback((files: FileList | File[]) => {
        const arr   = Array.from(files).filter(f => ALLOWED.includes(f.type));
        const slots = maxFiles - value.length - cropQueue.length;
        const toAdd = arr.slice(0, Math.max(0, slots));
        if (toAdd.length === 0) return;

        const items: CropQueueItem[] = toAdd.map(file => ({
            id:  uid(),
            file,
            src: URL.createObjectURL(file),
        }));
        setCropQueue(prev => [...prev, ...items]);
    }, [value.length, cropQueue.length, maxFiles]);

    // ── Crop confirm ─────────────────────────────────────────────────────

    async function handleCropConfirm(croppedFile: File) {
        if (cropQueue.length === 0) return;
        const current = cropQueue[0];

        // Advance queue first so next dialog opens immediately
        URL.revokeObjectURL(current.src);
        setCropQueue(prev => prev.slice(1));

        // Add to value as "uploading" with a temp blob URL
        const tempUrl = URL.createObjectURL(croppedFile);
        const itemId  = current.id;
        const newItem: PickedImage = {
            id:         itemId,
            url:        tempUrl,
            file:       croppedFile,
            name:       current.file.name,
            size:       croppedFile.size,
            status:     "uploading",
            is_primary: valueRef.current.length === 0,
        };

        const withNew = [...valueRef.current, newItem];
        onChangeRef.current(withNew);

        // Upload — read latest value via ref to avoid stale closures
        try {
            const { key, url } = await uploadFile(croppedFile, folder);
            URL.revokeObjectURL(tempUrl);
            const latest = valueRef.current;
            const idx    = latest.findIndex(i => i.id === itemId);
            if (idx !== -1) {
                const updated = [...latest];
                updated[idx]  = { ...updated[idx], key, url, status: "uploaded", file: undefined };
                onChangeRef.current(updated);
            }
        } catch (err) {
            const latest = valueRef.current;
            const idx    = latest.findIndex(i => i.id === itemId);
            if (idx !== -1) {
                const updated = [...latest];
                updated[idx]  = {
                    ...updated[idx],
                    status: "error",
                    error:  err instanceof Error ? err.message : "Upload failed",
                };
                onChangeRef.current(updated);
            }
        }
    }

    function handleCropCancel() {
        if (cropQueue.length === 0) return;
        URL.revokeObjectURL(cropQueue[0].src);
        setCropQueue(prev => prev.slice(1));
    }

    // ── Drag & drop ───────────────────────────────────────────────────────

    function handleDragOver(e: DragEvent) { e.preventDefault(); setIsDragOver(true); }
    function handleDragLeave(e: DragEvent) { e.preventDefault(); setIsDragOver(false); }
    function handleDrop(e: DragEvent) {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length > 0) queueFiles(e.dataTransfer.files);
    }
    function handleInput(e: ChangeEvent<HTMLInputElement>) {
        if (e.target.files?.length) { queueFiles(e.target.files); e.target.value = ""; }
    }

    // ── Image ops ─────────────────────────────────────────────────────────

    function removeImage(id: string) {
        const img = value.find(i => i.id === id);
        if (img?.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
        const remaining = value.filter(i => i.id !== id);
        if (img?.is_primary && remaining.length > 0) remaining[0] = { ...remaining[0], is_primary: true };
        onChange(remaining);
    }

    function setPrimary(id: string) {
        onChange(value.map(img => ({ ...img, is_primary: img.id === id })));
    }

    function moveImage(from: number, to: number) {
        if (to < 0 || to >= value.length) return;
        const arr = [...value];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        onChange(arr);
    }

    function handleThumbDragStart(index: number) { setDragIndex(index); }
    function handleThumbDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        moveImage(dragIndex, index);
        setDragIndex(index);
    }
    function handleThumbDragEnd() { setDragIndex(null); }

    // ── Counts ────────────────────────────────────────────────────────────

    const uploadingCount = value.filter(i => i.status === "uploading").length;
    const errorCount     = value.filter(i => i.status === "error").length;
    const uploadedCount  = value.filter(i => i.status === "uploaded").length;
    const queueTotal     = cropQueue.length + uploadingCount + uploadedCount + errorCount;

    return (
        <div className={cn("space-y-3", className)}>

            {/* Crop dialog — advances automatically through queue */}
            {cropQueue.length > 0 && (
                <CropDialog
                    key={cropQueue[0].id}
                    open
                    imageSrc={cropQueue[0].src}
                    cropConfig={crop}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                    queuePosition={
                        queueTotal > 1
                            ? { index: value.length + 1, total: queueTotal }
                            : undefined
                    }
                />
            )}

            {/* Drop zone */}
            {canAddMore && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                        "relative border-2 border-dashed rounded-xl cursor-pointer transition-all",
                        "flex flex-col items-center justify-center gap-3 p-8",
                        isDragOver
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : "border-border hover:border-primary/50 hover:bg-muted/50",
                    )}
                >
                    <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                        isDragOver ? "bg-primary/20" : "bg-muted",
                    )}>
                        {isDragOver
                            ? <Upload className="h-6 w-6 text-primary" />
                            : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        }
                    </div>
                    <div className="text-center">
                        <p className="font-medium text-sm">
                            {isDragOver ? "Drop images here" : label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {hint ?? `Drag & drop or click · JPG, PNG, WebP · up to ${maxFiles} images`}
                        </p>
                        {(value.length + cropQueue.length) > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {value.length + cropQueue.length}/{maxFiles} selected
                            </p>
                        )}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                        Browse Files
                    </Button>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleInput}
                className="hidden"
            />

            {/* Status bar */}
            {value.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                    <div className="flex items-center gap-3">
                        {uploadedCount > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                {uploadedCount} uploaded
                            </span>
                        )}
                        {uploadingCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {uploadingCount} uploading
                            </span>
                        )}
                        {errorCount > 0 && (
                            <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                {errorCount} failed
                            </span>
                        )}
                        {cropQueue.length > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <ImageIcon className="h-3 w-3" />
                                {cropQueue.length} to crop
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="text-destructive hover:underline"
                        onClick={() => {
                            value.forEach(img => { if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url); });
                            cropQueue.forEach(q => URL.revokeObjectURL(q.src));
                            onChange([]);
                            setCropQueue([]);
                        }}
                    >
                        Remove all
                    </button>
                </div>
            )}

            {/* Image grid */}
            {value.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {canAddMore && value.length > 0 && (
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className={cn(
                                thumbAspect,
                                "rounded-xl border-2 border-dashed border-border",
                                "flex flex-col items-center justify-center gap-1",
                                "hover:border-primary/50 hover:bg-muted/50 transition-colors",
                            )}
                        >
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Add</span>
                        </button>
                    )}

                    {value.map((image, index) => (
                        <div
                            key={image.id}
                            draggable
                            onDragStart={() => handleThumbDragStart(index)}
                            onDragOver={(e) => handleThumbDragOver(e, index)}
                            onDragEnd={handleThumbDragEnd}
                        >
                            <Thumb
                                image={image}
                                index={index}
                                total={value.length}
                                previewAspect={thumbAspect}
                                isDragging={dragIndex === index}
                                onRemove={() => removeImage(image.id)}
                                onSetPrimary={() => setPrimary(image.id)}
                                onMoveLeft={() => moveImage(index, index - 1)}
                                onMoveRight={() => moveImage(index, index + 1)}
                                dragHandleProps={{}}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
