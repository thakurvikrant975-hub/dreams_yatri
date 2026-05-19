"use client";

// app/components/dashboard/ImagePicker.tsx
// Reusable multi-image picker with drag-and-drop, preview, reorder

import {
    useState, useRef, useCallback,
    type DragEvent, type ChangeEvent,
} from "react";
import { ImageIcon, X, Upload, Loader2, GripVertical, Star, AlertCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export type PickedImage = {
    id: string;    // local unique id
    key?: string;    // R2 key after upload (undefined until uploaded)
    url: string;    // preview URL (object URL or R2 public URL)
    file?: File;   // original file (undefined for already-uploaded)
    name: string;
    size: number;    // bytes
    status: "pending" | "uploading" | "uploaded" | "error";
    error?: string;
    is_primary?: boolean;
};

type Props = {
    folder: "regions" | "destinations" | "hotels" | "packages" | "activities" | "attractions" | "vehicles";
    value?: PickedImage[];
    onChange: (images: PickedImage[]) => void;
    maxFiles?: number;
    label?: string;
    hint?: string;
    autoUpload?: boolean;   // upload immediately on drop/select (default: true)
    className?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];

// ── Upload function ───────────────────────────────────────────────────────

async function uploadFile(
    file: File,
    folder: string,
): Promise<{ key: string; url: string }> {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);

    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return { key: data.key, url: data.url };
}

// ── Image Thumbnail ───────────────────────────────────────────────────────

function ImageThumb({
    image,
    index,
    total,
    onRemove,
    onSetPrimary,
    onMoveLeft,
    onMoveRight,
    isDragging,
    dragHandleProps,
}: {
    image: PickedImage;
    index: number;
    total: number;
    onRemove: () => void;
    onSetPrimary: () => void;
    onMoveLeft: () => void;
    onMoveRight: () => void;
    isDragging?: boolean;
    dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
    return (
        <div
            className={cn(
                "group relative rounded-xl overflow-hidden border-2 bg-muted transition-all",
                "aspect-square",
                image.is_primary && "border-primary",
                !image.is_primary && "border-border hover:border-muted-foreground/50",
                isDragging && "opacity-50 scale-95",
                image.status === "error" && "border-destructive",
            )}
        >
            {/* Image preview */}
            <img
                src={image.url}
                alt={image.name}
                className="w-full h-full object-cover"
            />

            {/* Uploading overlay */}
            {image.status === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                    <span className="text-[10px] text-white font-medium">Uploading</span>
                </div>
            )}

            {/* Error overlay */}
            {image.status === "error" && (
                <div className="absolute inset-0 bg-destructive/60 flex flex-col items-center justify-center gap-1 p-2">
                    <AlertCircle className="h-4 w-4 text-white" />
                    <span className="text-[9px] text-white text-center leading-tight">{image.error}</span>
                </div>
            )}

            {/* Top bar — visible on hover */}
            {image.status !== "uploading" && (
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Drag handle */}
                    <div
                        {...dragHandleProps}
                        className="h-6 w-6 rounded bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="h-3 w-3 text-white" />
                    </div>

                    {/* Remove */}
                    <button
                        type="button"
                        onClick={onRemove}
                        className="h-6 w-6 rounded bg-black/60 hover:bg-destructive/80 flex items-center justify-center transition-colors"
                    >
                        <X className="h-3 w-3 text-white" />
                    </button>
                </div>
            )}

            {/* Bottom bar */}
            <div className="absolute inset-x-0 bottom-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between gap-1">
                {/* Set primary */}
                {!image.is_primary && image.status === "uploaded" && (
                    <button
                        type="button"
                        onClick={onSetPrimary}
                        className="flex-1 text-[9px] font-medium bg-black/60 hover:bg-primary/80 text-white rounded px-1.5 py-1 transition-colors"
                    >
                        Set primary
                    </button>
                )}
            </div>

            {/* Primary badge */}
            {image.is_primary && (
                <div className="absolute top-1 left-1 right-1 flex justify-center pointer-events-none">
                    {/* shown only when not hovering */}
                </div>
            )}
            {image.is_primary && (
                <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 bg-primary pointer-events-none">
                    <Star className="h-2.5 w-2.5 mr-0.5" />
                    Primary
                </Badge>
            )}

            {/* Uploaded checkmark */}
            {image.status === "uploaded" && (
                <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}

            {/* Move left/right — keyboard accessible reorder */}
            <div className="absolute inset-x-0 bottom-7 flex justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                    <button
                        type="button"
                        onClick={onMoveLeft}
                        className="h-5 w-5 rounded bg-black/60 text-white text-[10px] flex items-center justify-center"
                    >
                        ←
                    </button>
                )}
                {index < total - 1 && (
                    <button
                        type="button"
                        onClick={onMoveRight}
                        className="h-5 w-5 rounded bg-black/60 text-white text-[10px] flex items-center justify-center ml-auto"
                    >
                        →
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────

export function ImagePicker({
    folder,
    value = [],
    onChange,
    maxFiles = 10,
    label = "Upload Images",
    hint,
    autoUpload = true,
    className,
}: Props) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const canAddMore = value.length < maxFiles;

    // ── Process files ───────────────────────────────────────────────────────

    const processFiles = useCallback(async (files: FileList | File[]) => {
        const arr = Array.from(files);
        const allowed = arr.filter(f => ALLOWED_TYPES.includes(f.type));
        const slots = maxFiles - value.length;
        const toAdd = allowed.slice(0, slots);

        if (toAdd.length === 0) return;

        // Create preview images immediately
        const newImages: PickedImage[] = toAdd.map((file, i) => ({
            id: uid(),
            url: URL.createObjectURL(file),
            file,
            name: file.name,
            size: file.size,
            status: autoUpload ? "uploading" : "pending",
            is_primary: value.length === 0 && i === 0, // first image is primary
        }));

        onChange([...value, ...newImages]);

        if (!autoUpload) return;

        // Upload each file
        const uploaded = [...value, ...newImages];

        for (const img of newImages) {
            try {
                const { key, url } = await uploadFile(img.file!, folder);

                // Revoke old object URL
                URL.revokeObjectURL(img.url);

                // Update status
                const idx = uploaded.findIndex(i => i.id === img.id);
                if (idx !== -1) {
                    uploaded[idx] = { ...uploaded[idx], key, url, status: "uploaded", file: undefined };
                    onChange([...uploaded]);
                }
            } catch (err: unknown) {
                const idx = uploaded.findIndex(i => i.id === img.id);
                if (idx !== -1) {
                    uploaded[idx] = {
                        ...uploaded[idx],
                        status: "error",
                        error: err instanceof Error ? err.message : "Upload failed",
                    };
                    onChange([...uploaded]);
                }
            }
        }
    }, [value, onChange, folder, maxFiles, autoUpload]);

    // ── Drag and drop ───────────────────────────────────────────────────────

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) processFiles(files);
    }

    // ── File input ──────────────────────────────────────────────────────────

    function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
        if (e.target.files?.length) {
            processFiles(e.target.files);
            e.target.value = ""; // reset so same file can be re-selected
        }
    }

    // ── Image operations ────────────────────────────────────────────────────

    function removeImage(id: string) {
        const img = value.find(i => i.id === id);
        if (img?.url.startsWith("blob:")) URL.revokeObjectURL(img.url);

        const remaining = value.filter(i => i.id !== id);

        // If removed primary, assign to first remaining
        if (img?.is_primary && remaining.length > 0) {
            remaining[0] = { ...remaining[0], is_primary: true };
        }

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

    // ── Drag to reorder ─────────────────────────────────────────────────────

    function handleThumbDragStart(index: number) {
        setDragIndex(index);
    }

    function handleThumbDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        moveImage(dragIndex, index);
        setDragIndex(index);
    }

    function handleThumbDragEnd() {
        setDragIndex(null);
    }

    const pendingCount = value.filter(i => i.status === "uploading").length;
    const errorCount = value.filter(i => i.status === "error").length;
    const uploadedCount = value.filter(i => i.status === "uploaded").length;

    return (
        <div className={cn("space-y-3", className)}>

            {/* Drop zone — show when can add more */}
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
                        isDragOver ? "bg-primary/20" : "bg-muted"
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
                            {hint ?? `Drag & drop or click to browse · JPG, PNG, WebP · Up to ${maxFiles} images`}
                        </p>
                        {value.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {value.length}/{maxFiles} selected
                            </p>
                        )}
                    </div>

                    {/* Browse button */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="pointer-events-none"
                    >
                        Browse Files
                    </Button>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleInputChange}
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
                        {pendingCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {pendingCount} uploading
                            </span>
                        )}
                        {errorCount > 0 && (
                            <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                {errorCount} failed
                            </span>
                        )}
                    </div>

                    {value.length > 0 && (
                        <button
                            type="button"
                            className="text-destructive hover:underline"
                            onClick={() => {
                                value.forEach(img => {
                                    if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
                                });
                                onChange([]);
                            }}
                        >
                            Remove all
                        </button>
                    )}
                </div>
            )}

            {/* Image grid */}
            {value.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">

                    {/* Add more inline */}
                    {canAddMore && value.length > 0 && (
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className={cn(
                                "aspect-square rounded-xl border-2 border-dashed border-border",
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
                            <ImageThumb
                                image={image}
                                index={index}
                                total={value.length}
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

            {/* Retry errors */}
            {errorCount > 0 && (
                <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                        const errored = value.filter(i => i.status === "error" && i.file);
                        errored.forEach(img => processFiles([img.file!]));
                    }}
                >
                    Retry failed uploads
                </button>
            )}
        </div>
    );
}