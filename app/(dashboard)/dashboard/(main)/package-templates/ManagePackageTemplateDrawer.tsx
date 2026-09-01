"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Check, Utensils, Hotel, Car, StickyNote, Pencil } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  updatePackageTemplate, getPackageTemplateSnapshot,
  getOrCreateTemplateWorkingCopy,
  type PackageTemplateRow, type PackageTemplateSnapshot,
} from "./actions";

interface Props {
  template: PackageTemplateRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePackageTemplateDrawer({ template, open, onOpenChange }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpeningBuilder, startOpeningBuilder] = useTransition();
  const [snapshot, setSnapshot] = useState<PackageTemplateSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [destination, setDestination] = useState(template?.destination ?? "");

  useEffect(() => {
    if (!template) return;
    setTitle(template.title);
    setDescription(template.description ?? "");
    setDestination(template.destination ?? "");
    setSnapshot(null);
    setLoadingSnapshot(true);
    getPackageTemplateSnapshot(template.id).then((s) => { setSnapshot(s); setLoadingSnapshot(false); });
  }, [template]);

  if (!template) return null;

  function saveFields() {
    startTransition(async () => {
      const result = await updatePackageTemplate(template!.id, { title, description, destination });
      if (result.success) { toast.success("Saved"); router.refresh(); }
      else toast.error(result.error ?? "Failed to save");
    });
  }

  function openInBuilder() {
    startOpeningBuilder(async () => {
      const result = await getOrCreateTemplateWorkingCopy(template!.id);
      if (result.success) window.open(`/dashboard/package-builder/${result.packageId}`, "_blank", "noopener,noreferrer");
      else toast.error(result.error ?? "Failed to open in builder");
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-xl w-full">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="truncate">{template.title}</SheetTitle>
            <Badge>{template.status}</Badge>
          </div>
          <SheetDescription>
            Submitted by {template.submittedByName}
            {template.submittedByTeamName ? ` · ${template.submittedByTeamName}` : ""} · {formatDistanceToNow(new Date(template.submittedAt), { addSuffix: true })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {template.canManage && (
            <div className="grid gap-3 rounded-lg border p-3">
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Destination</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm resize-none" />
              </div>
              <Button size="sm" variant="outline" className="w-fit" disabled={isPending} onClick={saveFields}>
                Save changes
              </Button>
            </div>
          )}

          {template.canManage && (
            <div className="grid gap-1.5 rounded-lg border p-3">
              <Button size="sm" className="w-fit gap-1.5" disabled={isOpeningBuilder} onClick={openInBuilder}>
                {isOpeningBuilder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                Edit in Builder
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Opens the full package builder in a new tab — hotels, cabs, activities, everything — on a working
                copy of this template. Save to Template, and Approve or Reject, all happen from inside the builder
                — approving also saves your latest edits. The original package this was saved from is never touched.
              </p>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            {template.totalDays}D / {template.totalNights}N · {template.destination ?? "—"} · {template.activityCount} activit{template.activityCount === 1 ? "y" : "ies"}
          </div>

          {template.status === "REJECTED" && template.rejectionNote && (
            <p className="text-xs text-red-700 dark:text-red-400">Rejected by {template.rejectedByName}: &quot;{template.rejectionNote}&quot;</p>
          )}
          {template.status === "APPROVED" && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Approved by {template.approvedByName}</p>
          )}

          {loadingSnapshot ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : snapshot ? (
            <div className="space-y-3">
              {snapshot.days.map((day) => (
                <div key={day.day} className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-semibold">Day {day.day}{day.title ? ` — ${day.title}` : ""}</p>
                  {day.description && <p className="text-xs text-muted-foreground">{day.description}</p>}

                  {day.accommodation && (
                    <p className="text-xs flex items-center gap-1.5"><Hotel className="h-3 w-3 shrink-0" /> {day.accommodation}</p>
                  )}
                  {day.transport && (
                    <p className="text-xs flex items-center gap-1.5"><Car className="h-3 w-3 shrink-0" /> {day.transport}</p>
                  )}
                  {day.extraCabs.map((c, i) => (
                    <p key={i} className="text-xs flex items-center gap-1.5 text-muted-foreground pl-4.5">
                      + {c.quantity > 1 ? `${c.quantity}× ` : ""}{c.label}{c.vehicleType ? ` · ${c.vehicleType}` : ""}
                    </p>
                  ))}
                  {(day.meals.length > 0 || day.extraMeals.length > 0) && (
                    <p className="text-xs flex items-center gap-1.5"><Utensils className="h-3 w-3 shrink-0" /> {[...day.meals, ...day.extraMeals].join(", ")}</p>
                  )}
                  {day.notes && (
                    <p className="text-xs flex items-center gap-1.5"><StickyNote className="h-3 w-3 shrink-0" /> {day.notes}</p>
                  )}

                  {day.activities.length > 0 && (
                    <ul className="text-xs list-disc list-inside space-y-0.5 pl-1">
                      {day.activities.map((a, i) => <li key={i}>{a.title}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
