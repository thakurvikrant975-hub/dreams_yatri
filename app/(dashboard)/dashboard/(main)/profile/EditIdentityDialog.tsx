"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { ImageUpload, type UploadedImage } from "../components/dashboard/ImageUpload";
import { updateIdentityDocuments, type ProfileFormState } from "./actions";
import type { ProfileData } from "./ProfileClient";

export function EditIdentityDialog({ profile }: { profile: ProfileData }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]> | undefined>();

    const [aadhaarNumber, setAadhaarNumber] = useState(profile.aadhaarNumber ?? "");
    const [panNumber, setPanNumber] = useState(profile.panNumber ?? "");
    const [aadhaarFile, setAadhaarFile] = useState<UploadedImage | null>(
        profile.aadhaarFileKey ? { key: profile.aadhaarFileKey, url: profile.aadhaarFileUrl ?? "" } : null,
    );
    const [aadhaarBackFile, setAadhaarBackFile] = useState<UploadedImage | null>(
        profile.aadhaarBackFileKey ? { key: profile.aadhaarBackFileKey, url: profile.aadhaarBackFileUrl ?? "" } : null,
    );
    const [panFile, setPanFile] = useState<UploadedImage | null>(
        profile.panFileKey ? { key: profile.panFileKey, url: profile.panFileUrl ?? "" } : null,
    );

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (o) setErrors(undefined);
    }

    function handleSubmit() {
        startTransition(async () => {
            const fd = new FormData();
            fd.append("aadhaarNumber", aadhaarNumber);
            fd.append("panNumber", panNumber);
            if (aadhaarFile?.key) {
                fd.append("aadhaarFileKey", aadhaarFile.key);
                fd.append("aadhaarFileUrl", aadhaarFile.url);
            }
            if (aadhaarBackFile?.key) {
                fd.append("aadhaarBackFileKey", aadhaarBackFile.key);
                fd.append("aadhaarBackFileUrl", aadhaarBackFile.url);
            }
            if (panFile?.key) {
                fd.append("panFileKey", panFile.key);
                fd.append("panFileUrl", panFile.url);
            }

            const result: ProfileFormState = await updateIdentityDocuments({ success: false, message: "" }, fd);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setErrors(undefined);
            } else {
                toast.error(result.message);
                setErrors(result.errors);
            }
        });
    }

    return (
        <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenChange(true)}>
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Identity Documents</DialogTitle>
                        <DialogDescription>Used for HR verification — keep these accurate and up to date</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="aadhaarNumber">Aadhaar Number</Label>
                                <Input
                                    id="aadhaarNumber"
                                    value={aadhaarNumber}
                                    onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                                    placeholder="123456789012"
                                    maxLength={12}
                                />
                                {errors?.aadhaarNumber && <p className="text-xs text-destructive">{errors.aadhaarNumber[0]}</p>}
                            </div>
                            <ImageUpload
                                name="_aadhaar_unused"
                                label="Upload Aadhaar Card (Front)"
                                folder="team-members"
                                aspectRatio="wide"
                                maxSizeMB={2}
                                value={aadhaarFile}
                                onChange={setAadhaarFile}
                            />
                            <ImageUpload
                                name="_aadhaar_back_unused"
                                label="Upload Aadhaar Card (Back)"
                                folder="team-members"
                                aspectRatio="wide"
                                maxSizeMB={2}
                                value={aadhaarBackFile}
                                onChange={setAadhaarBackFile}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="panNumber">PAN Number</Label>
                                <Input
                                    id="panNumber"
                                    value={panNumber}
                                    onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                                    placeholder="ABCDE1234F"
                                    maxLength={10}
                                />
                                {errors?.panNumber && <p className="text-xs text-destructive">{errors.panNumber[0]}</p>}
                            </div>
                            <ImageUpload
                                name="_pan_unused"
                                label="Upload PAN Card"
                                folder="team-members"
                                aspectRatio="wide"
                                value={panFile}
                                onChange={setPanFile}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleSubmit} disabled={isPending}>
                            {isPending ? "Saving…" : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
