"use client";

import { useState, useTransition } from "react";
import { Star, Trash2, Loader2, ImageIcon } from "lucide-react";
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
    updateActivityImageLabel,
    type ActivityImage,
} from "../../actions";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Single image thumb ─────────────────────────────────────────────────────

function ImageThumb({
    image,
    activityId,
    onDelete,
    onSetPrimary,
}: {
    image:        ActivityImage;
    activityId:   number;
    onDelete:     () => void;
    onSetPrimary: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [label,       setLabel]       = useState(image.label ?? "");
    const [labelSaving, setLabelSaving] = useState(false);

    function saveLabel() {
        if (label === (image.label ?? "")) return;
        setLabelSaving(true);
        startTransition(async () => {
            const r = await updateActivityImageLabel(image.id, label);
            if (r.success) toast.success("Label saved");
            else toast.error(r.message);
            setLabelSaving(false);
        });
    }

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
                onChange={e => setLabel(e.target.value)}
                onBlur={saveLabel}
                onKeyDown={e => e.key === "Enter" && saveLabel()}
                placeholder="Add label…"
                disabled={labelSaving}
                className="w-full text-[11px] border border-border rounded-md px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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

    function handleDelete(id: number) {
        setImages(prev => prev.filter(img => img.id !== id));
    }

    function handleSetPrimary(id: number) {
        setImages(prev => prev.map(img => ({ ...img, is_primary: img.id === id })));
    }

    function handleSave() {
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

            if (result.success) {
                toast.success(result.message);
                setNewPicks([]);
                const added: ActivityImage[] = uploaded.map((p, i) => ({
                    id:         Date.now() + i,
                    url:        p.key!,
                    thumbnail:  p.key ?? null,
                    is_primary: images.length === 0 && i === 0,
                    sort_order: images.length + i,
                    label:      null,
                }));
                setImages(prev => [...prev, ...added]);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Images
                </CardTitle>
                <CardDescription>
                    {images.length} photo{images.length !== 1 ? "s" : ""} · First image is used as thumbnail for {activityName}
                </CardDescription>
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
                    <ImagePicker
                        folder="activities"
                        value={newPicks}
                        onChange={setNewPicks}
                        maxFiles={10}
                        label="Upload Activity Photos"
                        hint="JPG, PNG, WebP · Upload multiple at once"
                    />
                    {newPicks.length > 0 && (
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSave}
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
