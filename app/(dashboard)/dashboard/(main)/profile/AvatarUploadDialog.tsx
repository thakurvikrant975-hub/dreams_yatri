"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { ImageUpload, type UploadedImage } from "../components/dashboard/ImageUpload";
import { updateAvatar } from "./actions";

export function AvatarUploadDialog({
    open,
    onOpenChange,
    currentUrl,
    name,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUrl: string | null;
    name: string;
}) {
    const [isPending, startTransition] = useTransition();
    const [image, setImage] = useState<UploadedImage | null>(
        currentUrl ? { key: "", url: currentUrl } : null,
    );

    function handleChange(img: UploadedImage | null) {
        setImage(img);
        if (!img?.key) return;
        startTransition(async () => {
            const result = await updateAvatar(img.key, img.url);
            if (result.success) {
                toast.success(result.message);
                onOpenChange(false);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change Profile Photo</DialogTitle>
                    <DialogDescription>This is shown across the dashboard wherever {name.split(" ")[0]}&apos;s name appears</DialogDescription>
                </DialogHeader>

                <ImageUpload
                    name="_avatar_unused"
                    label={isPending ? "Saving…" : "Upload Photo"}
                    folder="team-members"
                    aspectRatio="square"
                    value={image}
                    onChange={handleChange}
                />
            </DialogContent>
        </Dialog>
    );
}
