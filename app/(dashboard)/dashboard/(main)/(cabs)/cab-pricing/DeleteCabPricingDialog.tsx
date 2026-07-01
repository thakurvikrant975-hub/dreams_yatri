"use client";

import { useState, useTransition }    from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button }  from "../../components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { deleteCabPricingForLocation } from "./actions";
import { toast } from "sonner";

export function DeleteCabPricingDialog({
  locationId,
  locationName,
  vehicleCount,
}: {
  locationId:   string;
  locationName: string;
  vehicleCount: number;
}) {
  const [open,     setOpen]          = useState(false);
  const [errorMsg, setErrorMsg]      = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) setErrorMsg(null);
    setOpen(next);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCabPricingForLocation(locationId);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
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
          <AlertDialogTitle>Delete Cab Pricing</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete all cab pricing for{" "}
                <span className="font-semibold text-foreground">{locationName}</span>?
                This will remove{" "}
                <span className="font-semibold text-foreground">{vehicleCount}</span>{" "}
                vehicle price{vehicleCount !== 1 ? "s" : ""}. This action cannot be undone.
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
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
              : "Delete Pricing"
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
