"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { changeMyPassword, type ProfileFormState } from "./actions";

function PasswordInput({
    id, name, value, onChange, error,
}: {
    id: string;
    name: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <Input
                id={id} name={name}
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pr-9"
            />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
            >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
    );
}

export function ChangePasswordDialog() {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]> | undefined>();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    function reset() {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors(undefined);
    }

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (o) reset();
    }

    function handleSubmit() {
        startTransition(async () => {
            const fd = new FormData();
            fd.append("currentPassword", currentPassword);
            fd.append("newPassword", newPassword);
            fd.append("confirmPassword", confirmPassword);

            const result: ProfileFormState = await changeMyPassword({ success: false, message: "" }, fd);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                reset();
            } else {
                toast.error(result.message);
                setErrors(result.errors);
            }
        });
    }

    const weak = newPassword.length > 0 && newPassword.length < 8;

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
                Change Password
            </Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-dashboard-warning" />
                            Change Password
                        </DialogTitle>
                        <DialogDescription>
                            Enter your current password to confirm it&apos;s you, then choose a new one
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <PasswordInput
                                id="currentPassword" name="currentPassword"
                                value={currentPassword} onChange={setCurrentPassword}
                                error={errors?.currentPassword?.[0]}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="newPassword">New Password</Label>
                            <PasswordInput
                                id="newPassword" name="newPassword"
                                value={newPassword} onChange={setNewPassword}
                                error={errors?.newPassword?.[0]}
                            />
                            {weak && <p className="text-xs text-dashboard-warning mt-1">At least 8 characters</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <PasswordInput
                                id="confirmPassword" name="confirmPassword"
                                value={confirmPassword} onChange={setConfirmPassword}
                                error={errors?.confirmPassword?.[0]}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
                        >
                            {isPending ? "Updating…" : "Update Password"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
