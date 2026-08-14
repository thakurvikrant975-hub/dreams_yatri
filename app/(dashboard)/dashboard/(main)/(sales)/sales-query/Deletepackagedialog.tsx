"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { deleteCustomPackage } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { toast } from "sonner";

type Props = {
    packageId:    string;
    packageTitle: string;
    onDone?:      () => void;
};

export function DeletePackageDialog({ packageId, packageTitle, onDone }: Props) {
    const [open, setOpen]              = useState(false);
    const [errorMsg, setErrorMsg]      = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleOpenChange(next: boolean) {
        if (!next) setErrorMsg(null);
        setOpen(next);
    }

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteCustomPackage(packageId);
            if (result.success) {
                toast.success(`"${packageTitle}" deleted.`);
                setOpen(false);
                onDone?.();
            } else {
                setErrorMsg(result.error ?? "Failed to delete this package.");
            }
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <button
                    type="button"
                    title="Delete package"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            </AlertDialogTrigger>

            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Package</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <p>
                                Are you sure you want to permanently delete{" "}
                                <span className="font-semibold text-foreground">{packageTitle}</span>?
                                This can&apos;t be undone — the itinerary, hotels/cabs, tickets and
                                add-ons will all be removed.
                            </p>
                            {errorMsg && (
                                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p className="text-xs leading-relaxed">{errorMsg}</p>
                                </div>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {isPending
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
                            : "Delete"
                        }
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
