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
import { updateFamilyDetails, type ProfileFormState } from "./actions";
import type { ProfileData } from "./ProfileClient";

export function EditFamilyDialog({ profile }: { profile: ProfileData }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]> | undefined>();

    function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const result: ProfileFormState = await updateFamilyDetails({ success: false, message: "" }, formData);
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Family Details</DialogTitle>
                        <DialogDescription>Your parents&apos; details, kept on file for HR records</DialogDescription>
                    </DialogHeader>

                    <form action={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="fatherName">Father&apos;s Name</Label>
                                <div className="flex gap-1.5">
                                    <select
                                        id="fatherTitle" name="fatherTitle"
                                        defaultValue={profile.fatherTitle ?? "MR"}
                                        className="h-9 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                                    >
                                        <option value="MR">Mr.</option>
                                        <option value="LATE_MR">Late Mr.</option>
                                        <option value="DR">Dr.</option>
                                    </select>
                                    <Input id="fatherName" name="fatherName" defaultValue={profile.fatherName ?? ""} className="flex-1" />
                                </div>
                                {errors?.fatherName && <p className="text-xs text-destructive">{errors.fatherName[0]}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fatherMobile">Father&apos;s Mobile</Label>
                                <Input id="fatherMobile" name="fatherMobile" defaultValue={profile.fatherMobile ?? ""} />
                                {errors?.fatherMobile && <p className="text-xs text-destructive">{errors.fatherMobile[0]}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="motherName">Mother&apos;s Name</Label>
                                <div className="flex gap-1.5">
                                    <select
                                        id="motherTitle" name="motherTitle"
                                        defaultValue={profile.motherTitle ?? "MRS"}
                                        className="h-9 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                                    >
                                        <option value="MRS">Mrs.</option>
                                        <option value="LATE_MRS">Late Mrs.</option>
                                        <option value="DR">Dr.</option>
                                    </select>
                                    <Input id="motherName" name="motherName" defaultValue={profile.motherName ?? ""} className="flex-1" />
                                </div>
                                {errors?.motherName && <p className="text-xs text-destructive">{errors.motherName[0]}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="motherMobile">Mother&apos;s Mobile</Label>
                                <Input id="motherMobile" name="motherMobile" defaultValue={profile.motherMobile ?? ""} />
                                {errors?.motherMobile && <p className="text-xs text-destructive">{errors.motherMobile[0]}</p>}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Saving…" : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
