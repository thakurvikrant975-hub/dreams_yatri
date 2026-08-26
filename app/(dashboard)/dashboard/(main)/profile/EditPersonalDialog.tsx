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
import { updatePersonalDetails, type ProfileFormState } from "./actions";
import type { ProfileData } from "./ProfileClient";

export function EditPersonalDialog({ profile }: { profile: ProfileData }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]> | undefined>();

    function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const result: ProfileFormState = await updatePersonalDetails({ success: false, message: "" }, formData);
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
                        <DialogTitle>Edit Personal Details</DialogTitle>
                        <DialogDescription>Update your personal contact information</DialogDescription>
                    </DialogHeader>

                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="personalEmail">Personal Email</Label>
                            <Input
                                id="personalEmail" name="personalEmail" type="email"
                                defaultValue={profile.personalEmail ?? ""}
                                placeholder="you@example.com"
                            />
                            {errors?.personalEmail && <p className="text-xs text-destructive">{errors.personalEmail[0]}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="personalMobile">Personal Mobile</Label>
                            <Input
                                id="personalMobile" name="personalMobile"
                                defaultValue={profile.personalMobile ?? ""}
                                placeholder="9876543210"
                            />
                            {errors?.personalMobile && <p className="text-xs text-destructive">{errors.personalMobile[0]}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="alternativeMobile">Alternative Mobile</Label>
                            <Input
                                id="alternativeMobile" name="alternativeMobile"
                                defaultValue={profile.alternativeMobile ?? ""}
                                placeholder="9876543210"
                            />
                            {errors?.alternativeMobile && <p className="text-xs text-destructive">{errors.alternativeMobile[0]}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="officialMobile">Official Mobile</Label>
                            <Input
                                id="officialMobile" name="officialMobile"
                                defaultValue={profile.officialMobile ?? ""}
                                placeholder="9876543210"
                            />
                            {errors?.officialMobile && <p className="text-xs text-destructive">{errors.officialMobile[0]}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="gender">Gender</Label>
                            <select
                                id="gender" name="gender"
                                defaultValue={profile.gender ?? ""}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Select…</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                                <option value="PREFER_NOT_TO_SAY">Can&apos;t say</option>
                            </select>
                            {errors?.gender && <p className="text-xs text-destructive">{errors.gender[0]}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dateOfBirth">Date of Birth</Label>
                            <Input
                                id="dateOfBirth" name="dateOfBirth" type="date"
                                defaultValue={profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : ""}
                            />
                            {errors?.dateOfBirth && <p className="text-xs text-destructive">{errors.dateOfBirth[0]}</p>}
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
