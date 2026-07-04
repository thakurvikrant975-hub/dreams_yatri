"use client";

import { useState, useTransition } from "react";
import { Star, Trash2, Loader2, ImageIcon, Save } from "lucide-react";
import { Button }   from "../../../components/ui/button";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { ImagePickerWithCrop, type PickedImage } from "../../../components/dashboard/ImagePickerWithCrop";
import { toast } from "sonner";
import { cn }   from "@/app/lib/utils";
import {
    addActivityImages,
    deleteActivityImage,
    setPrimaryActivityImage,
    batchSaveActivityImageLabels,
    type ActivityImage,
} from "../../actions";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Single image thumb ─────────────────────────────────────────────────────

function ImageThumb({
    image,
    activityId,
    label,
    onLabelChange,
    onDelete,
    onSetPrimary,
}: {
    image:         ActivityImage;
    activityId:    number;
    label:         string;
    onLabelChange: (id: number, value: string) => void;
    onDelete:      () => void;
    onSetPrimary:  () => void;
}) {
    const [isPending, startTransition] = useTransition();

    return (
        <div className="flex flex-col gap-1.5">
            <div className={cn(
                "group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted",
                image.is_primary ? "border-primary" : "border-border hover:border-muted-foreground/40",
            )}>
                <img
                    src={`${BASE}/${image.url}`}
                    alt={label || "Activity image"}
                    className="w-full h-full object-cover"
                />

                {image.is_primary && (
                    <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0 pointer-events-none bg-primary">
                        <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
                    </Badge>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                    {!image.is_primary && (
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="text-[10px] h-6 px-2"
                            disabled={isPending}
                            onClick={() => startTransition(async () => {
                                const r = await setPrimaryActivityImage(image.id, activityId);
                                if (r.success) { toast.success(r.message); onSetPrimary(); }
                                else toast.error(r.message);
                            })}
                        >
                            <Star className="h-2.5 w-2.5 mr-1" /> Set Primary
                        </Button>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" size="sm" variant="destructive" className="text-[10px] h-6 px-2">
                                <Trash2 className="h-2.5 w-2.5 mr-1" /> Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Image</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Permanently deletes from R2 storage too.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => startTransition(async () => {
                                        const r = await deleteActivityImage(
                                            image.id, activityId, image.url, image.thumbnail ?? undefined,
                                        );
                                        if (r.success) { toast.success(r.message); onDelete(); }
                                        else toast.error(r.message);
                                    })}
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <input
                type="text"
                value={label}
                onChange={e => onLabelChange(image.id, e.target.value)}
                placeholder="Add label…"
                className="w-full text-[11px] border border-border rounded-md px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
        </div>
    );
}

// ── Images Tab ─────────────────────────────────────────────────────────────

export function ImagesTab({
    activityId,
    activityName,
    initialImages,
}: {
    activityId:    number;
    activityName:  string;
    initialImages: ActivityImage[];
}) {
    const [images,    setImages]    = useState<ActivityImage[]>(initialImages);
    const [newPicks,  setNewPicks]  = useState<PickedImage[]>([]);
    const [isPending, startTransition] = useTransition();

    // Track label edits: map from image.id → current label value
    const [labelDraft, setLabelDraft] = useState<Record<number, string>>(
        () => Object.fromEntries(initialImages.map(img => [img.id, img.label ?? ""]))
    );

    const dirtyLabels = images.filter(img => (labelDraft[img.id] ?? "") !== (img.label ?? ""));
    const hasDirtyLabels = dirtyLabels.length > 0;

    function handleLabelChange(id: number, value: string) {
        const v = value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
        setLabelDraft(prev => ({ ...prev, [id]: v }));
    }

    function handleDelete(id: number) {
        setImages(prev => prev.filter(img => img.id !== id));
        setLabelDraft(prev => { const next = { ...prev }; delete next[id]; return next; });
    }

    function handleSetPrimary(id: number) {
        setImages(prev => prev.map(img => ({ ...img, is_primary: img.id === id })));
    }

    function handleSaveLabels() {
        startTransition(async () => {
            const updates = dirtyLabels.map(img => ({
                id:    img.id,
                label: labelDraft[img.id] ?? "",
            }));
            const r = await batchSaveActivityImageLabels(activityId, updates);
            if (r.success) {
                toast.success(r.message);
                setImages(prev => prev.map(img => ({
                    ...img,
                    label: labelDraft[img.id] !== undefined ? (labelDraft[img.id] || null) : img.label,
                })));
            } else {
                toast.error(r.message);
            }
        });
    }

    function handleSaveImages() {
        const uploaded = newPicks.filter(p => p.status === "uploaded" && p.key);
        if (uploaded.length === 0) {
            toast.error("Wait for uploads to complete");
            return;
        }

        startTransition(async () => {
            const result = await addActivityImages(
                activityId,
                uploaded.map(p => ({ url: p.key!, thumbnail: p.key })),
            );

            if (result.success && result.images) {
                toast.success(result.message);
                setNewPicks([]);
                // Use real DB IDs returned from server — avoids Int overflow from Date.now()
                const newLabels: Record<number, string> = {};
                result.images.forEach(img => { newLabels[img.id] = img.label ?? ""; });
                setLabelDraft(prev => ({ ...prev, ...newLabels }));
                setImages(prev => [...prev, ...result.images!]);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" /> Highlights &amp; Images
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {images.length} photo{images.length !== 1 ? "s" : ""} · First image is used as thumbnail for {activityName}
                        </CardDescription>
                    </div>
                    {hasDirtyLabels && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSaveLabels}
                            disabled={isPending}
                            className="gap-1.5 shrink-0"
                        >
                            {isPending
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
                                : <><Save className="h-3.5 w-3.5" />Save Labels</>
                            }
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {images.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {images
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map(img => (
                                <ImageThumb
                                    key={img.id}
                                    image={img}
                                    activityId={activityId}
                                    label={labelDraft[img.id] ?? img.label ?? ""}
                                    onLabelChange={handleLabelChange}
                                    onDelete={() => handleDelete(img.id)}
                                    onSetPrimary={() => handleSetPrimary(img.id)}
                                />
                            ))}
                    </div>
                ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-xl">
                        <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No photos yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload photos to showcase this activity</p>
                    </div>
                )}

                <div className="space-y-3">
                    <p className="text-sm font-medium">Add Photos</p>
                    <ImagePickerWithCrop
                        folder="activities"
                        value={newPicks}
                        onChange={setNewPicks}
                        crop={{ width: 1200, height: 800, label: "1200 × 800" }}
                        maxFiles={10}
                        label="Upload Activity Photos"
                        hint="JPG, PNG, WebP · Each image opens the crop tool"
                    />
                    {newPicks.length > 0 && (
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSaveImages}
                                disabled={isPending || newPicks.some(p => p.status === "uploading")}
                                className="gap-1.5"
                            >
                                {isPending
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
                                    : <>Save {newPicks.filter(p => p.status === "uploaded").length} Photo{newPicks.filter(p => p.status === "uploaded").length !== 1 ? "s" : ""}</>
                                }
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
