"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpen, MapPin } from "./builder-icons";
import { toast } from "sonner";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Label } from "@/app/(dashboard)/dashboard/(main)/components/ui/label";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Textarea } from "@/app/(dashboard)/dashboard/(main)/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger, DialogDescription,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import {
  saveCustomPackageToLibrary, getLibraryDestinationCount,
} from "@/app/(dashboard)/dashboard/(main)/package-templates/actions";

type Props = {
  packageId: string;
  /** The builder's own current values — what this trip is actually titled/
   * described/going to right now, not a re-fetch of the saved package. The
   * template is seeded from these but doesn't have to end up matching them:
   * a team's library-facing name for a stay ("Goa Beach Escape") is often
   * not the internal booking title ("Sharma Family — 4N Goa"). */
  title: string;
  description: string;
  destination: string;
  onSuccess: () => void;
  children: React.ReactNode;
};

/** Debounced so retyping a destination doesn't fire a count query per
 * keystroke — 400ms is long enough to outlast a normal typing burst, short
 * enough that the number still feels live. */
const COUNT_DEBOUNCE_MS = 400;

export function SaveToLibraryDialog({ packageId, title, description, destination, onSuccess, children }: Props) {
  const [open, setOpen] = useState(false);
  const [formTitle, setFormTitle] = useState(title);
  const [formDescription, setFormDescription] = useState(description);
  const [formDestination, setFormDestination] = useState(destination);
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-seed from the builder's current values every time the dialog opens —
  // otherwise a second open after editing the trip title elsewhere would
  // still show whatever was typed into the dialog last time.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setFormTitle(title);
      setFormDescription(description);
      setFormDestination(destination);
    }
  }

  useEffect(() => {
    if (!open) return;
    const trimmed = formDestination.trim();
    // No fetch for an empty destination — the JSX below never reads `count`
    // in that branch, so there's nothing to clear it for; the next non-empty
    // edit's own "Checking the library…" loading state covers any staleness.
    if (!trimmed) return;
    let cancelled = false;
    setCountLoading(true);
    const timer = setTimeout(() => {
      getLibraryDestinationCount(trimmed).then((n) => {
        if (!cancelled) setCount(n);
      }).finally(() => {
        if (!cancelled) setCountLoading(false);
      });
    }, COUNT_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDestination, open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    startTransition(async () => {
      const result = await saveCustomPackageToLibrary(packageId, {
        title: formTitle,
        description: formDescription,
        destination: formDestination,
      });
      if (result.success) {
        toast.success(
          `Saved to library — ${result.activityCount} activit${result.activityCount === 1 ? "y" : "ies"} included, awaiting your team leader's review.`,
        );
        setOpen(false);
        onSuccess();
      } else {
        toast.error(result.error ?? "Failed to save to library");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Save to Library
          </DialogTitle>
          <DialogDescription>
            Adds a reusable copy of this itinerary to the template library, for your team leader to review.
            The live package itself is untouched.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="libraryTitle">
              Template title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="libraryTitle"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Goa Beach Escape — 4N"
              className="h-9 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="libraryDestination">Destination</Label>
            <Input
              id="libraryDestination"
              value={formDestination}
              onChange={(e) => setFormDestination(e.target.value)}
              placeholder="e.g. Goa"
              className="h-9 text-sm"
            />
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {!formDestination.trim()
                ? "No destination set — the template will be harder to find in the library."
                : countLoading
                  ? "Checking the library…"
                  : count === 0
                    ? `First template for ${formDestination.trim()}.`
                    : `${count} other template${count === 1 ? "" : "s"} already in the library for ${formDestination.trim()}.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="libraryDescription">Description</Label>
            <Textarea
              id="libraryDescription"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What makes this itinerary worth reusing…"
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !formTitle.trim()}>
              {isPending ? "Saving..." : "Save to Library"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
