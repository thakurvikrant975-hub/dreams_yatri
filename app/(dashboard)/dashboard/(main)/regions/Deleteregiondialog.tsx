"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button }                         from "../components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { deleteRegion } from "./actions";
import { toast }        from "sonner";

export function DeleteRegionDialog({
  id,
  name,
  destinationCount,
}: {
  id:               number;
  name:             string;
  destinationCount: number;
}) {
  const [open, setOpen]           = useState(false);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) setErrorMsg(null); // clear error when dialog closes
    setOpen(next);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRegion(id);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        // Keep dialog open — show exact reason (includes linked destination names)
        setErrorMsg(result.message);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Region</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">{name}</span>?
                This action cannot be undone.
              </p>

              {/* Pre-flight warning from table count */}
              {destinationCount > 0 && !errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    This region has{" "}
                    <span className="font-semibold">{destinationCount}</span>{" "}
                    linked destination{destinationCount !== 1 ? "s" : ""}. Deleting will
                    fail — remove them first.
                  </p>
                </div>
              )}

              {/* Server error with exact destination names */}
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
              e.preventDefault(); // prevent AlertDialog auto-close
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
