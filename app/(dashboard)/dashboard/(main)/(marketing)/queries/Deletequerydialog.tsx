"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { deleteQuery } from "./actions";
import { toast } from "sonner";

type Props = {
    queryId:  string;
    leadName: string;
    onDone?:  () => void;
    compact?: boolean;
};

export function DeleteQueryDialog({ queryId, leadName, onDone, compact = false }: Props) {
    const [open, setOpen]              = useState(false);
    const [errorMsg, setErrorMsg]      = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleOpenChange(next: boolean) {
        if (!next) setErrorMsg(null);
        setOpen(next);
    }

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteQuery(queryId);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                onDone?.();
            } else {
                setErrorMsg(result.message);
            }
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    variant={compact ? "outline" : "ghost"}
                    size={compact ? "sm" : "icon"}
                    className={compact
                        ? "gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                        : "h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    {compact && "Delete"}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Query</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <p>
                                Are you sure you want to delete the query from{" "}
                                <span className="font-semibold text-foreground">{leadName}</span>?
                                It will be removed from this list — nothing is permanently lost.
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
