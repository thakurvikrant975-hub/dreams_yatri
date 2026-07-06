"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Star, Trash2, Loader2, ImageIcon, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button }   from "../../../components/ui/button";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
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
const MIN_IMAGES = 3;

// ── Single image thumb ─────────────────────────────────────────────────────

function ImageThumb({
    image,
    activityId,
    label,
    onLabelChange,
    onDelete,
    onSetPrimary,
    willDropBelowMin,
}: {
    image:             ActivityImage;
    activityId:        number;
    label:             string;
    onLabelChange:     (id: number, value: string) => void;
    onDelete:          () => void;
    onSetPrimary:      () => void;
    willDropBelowMin?: boolean;
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
                            {willDropBelowMin && (
                                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    Deleting this will drop below the {MIN_IMAGES}-photo minimum.
                                </p>
                            )}
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

    // Auto-save: fire once all staged uploads finish
    const autoSaveRef = useRef(false);
    useEffect(() => {
        if (newPicks.length === 0) { autoSaveRef.current = false; return; }
        if (newPicks.some(p => p.status === "uploading")) return;
        const uploaded = newPicks.filter(p => p.status === "uploaded" && p.key);
        if (uploaded.length === 0) return;
        if (autoSaveRef.current) return;
        autoSaveRef.current = true;
        startTransition(async () => {
            const result = await addActivityImages(
                activityId,
                uploaded.map(p => ({ url: p.key!, thumbnail: p.key })),
            );
            if (result.success && result.images) {
                toast.success(result.message);
                setNewPicks([]);
                const newLabels: Record<number, string> = {};
                result.images.forEach(img => { newLabels[img.id] = img.label ?? ""; });
                setLabelDraft(prev => ({ ...prev, ...newLabels }));
                setImages(prev => [...prev, ...result.images!]);
            } else {
                toast.error(result.message);
                autoSaveRef.current = false;
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newPicks]);

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


    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" /> Highlights &amp; Images
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                            <span>
                                {images.length} photo{images.length !== 1 ? "s" : ""} · First image is used as thumbnail for {activityName}
                            </span>
                            <span className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
                                images.length >= MIN_IMAGES
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200",
                            )}>
                                {images.length >= MIN_IMAGES
                                    ? <CheckCircle2 className="h-3 w-3" />
                                    : <AlertTriangle className="h-3 w-3" />
                                }
                                {images.length}/{MIN_IMAGES} minimum
                            </span>
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
                                    willDropBelowMin={images.length - 1 < MIN_IMAGES}
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
                    <ImagePicker
                        folder="activities"
                        value={newPicks}
                        onChange={setNewPicks}
                        maxFiles={10}
                        label="Upload Activity Photos"
                        hint="JPG, PNG, WebP"
                    />
                    {isPending && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
                            <Loader2 className="h-3 w-3 animate-spin" /> Saving photos…
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
