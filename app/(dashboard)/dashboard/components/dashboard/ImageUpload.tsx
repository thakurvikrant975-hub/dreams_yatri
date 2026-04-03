"use client";
// app/components/dashboard/ImageUpload.tsx

import { useState, useRef } from "react";
import { ImageIcon, X, Loader2, CheckCircle2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadedImage = {
    key: string;   // R2 key — what gets stored in DB
    url: string;   // full public URL — for preview only
};

type Props = {
    name: string;          // form field name — matches DB column
    label?: string;
    value?: UploadedImage | null;
    onChange?: (img: UploadedImage | null) => void;
    folder: "regions" | "destinations" | "hotels" | "packages" | "activities";
    aspectRatio?: "square" | "video" | "wide";
};

export function ImageUpload({
    name,
    label = "Upload Image",
    value,
    onChange,
    folder,
    aspectRatio = "video",
}: Props) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const aspectClass = {
        square: "aspect-square",
        video: "aspect-video",
        wide: "aspect-[16/6]",
    }[aspectRatio];

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setUploading(true);

        try {
            const body = new FormData();
            body.append("file", file);
            body.append("folder", folder);

            const res = await fetch("/api/upload", { method: "POST", body });
            const data = await res.json();

            if (!res.ok) { setError(data.error ?? "Upload failed"); return; }

            // data = { key, url }
            onChange?.({ key: data.key, url: data.url });
        } catch {
            setError("Upload failed. Please try again.");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <div className="space-y-1.5">
            {value?.url ? (
                <div className={cn("relative rounded-xl overflow-hidden bg-muted border", aspectClass)}>
                    <img src={value.url} alt="Preview" className="w-full h-full object-cover" />

                    {/* Uploaded badge */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                        <span className="text-[10px] text-white font-medium">Uploaded</span>
                    </div>

                    {/* Change button */}
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="absolute top-2 left-2 h-7 px-2 rounded-full bg-black/60 hover:bg-black/80 flex items-center gap-1 transition-colors"
                    >
                        <Upload className="h-3 w-3 text-white" />
                        <span className="text-[10px] text-white">Change</span>
                    </button>

                    {/* Remove button */}
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
                        aspectClass
                    )}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Uploading to R2...</span>
                        </>
                    ) : (
                        <>
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="text-center px-4">
                                <p className="text-sm font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP up to 20MB</p>
                            </div>
                        </>
                    )}
                </button>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Hidden input stores R2 key for server action */}
            <input type="hidden" name={name} value={value?.key ?? ""} />

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleFile}
                className="hidden"
            />
        </div>
    );
}