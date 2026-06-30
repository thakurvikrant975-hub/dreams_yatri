"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
    Link2, Building2, Compass, Milestone, Car, Unlink, Loader2,
    ExternalLink, Repeat, Check, X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "../components/ui/sheet";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { LocationSearchSelect } from "../components/location/LocationSearchSelect";
import type { LocationValue } from "../components/location/location.types";
import {
    getLocationLinkedItems, unlinkLocationReference, relinkLocationReference,
    type LocationLinkedItem, type LinkedItemKind,
} from "./actions";

const KIND_META: Record<LinkedItemKind, { icon: typeof Building2; label: string; className: string }> = {
    hotel: { icon: Building2, label: "Hotel", className: "bg-dashboard-primary/10 text-dashboard-primary" },
    activity: { icon: Compass, label: "Activity", className: "bg-dashboard-success/10 text-dashboard-success" },
    route_stop: { icon: Milestone, label: "Route Stop", className: "bg-dashboard-warning/10 text-dashboard-warning" },
    transfer_pickup: { icon: Car, label: "Transfer Pickup", className: "bg-dashboard-info/10 text-dashboard-info" },
    transfer_drop: { icon: Car, label: "Transfer Drop", className: "bg-dashboard-info/10 text-dashboard-info" },
};

function UnlinkButton({ item, onChanged }: { item: LocationLinkedItem; onChanged: () => void }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleConfirm() {
        startTransition(async () => {
            const result = await unlinkLocationReference(item.kind, item.refId);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                onChanged();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Unlink from this location"
                onClick={() => setOpen(true)}
            >
                <Unlink className="h-3.5 w-3.5" />
            </Button>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unlink {KIND_META[item.kind].label}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Remove the location link from <span className="font-semibold">{item.label}</span>?
                        This only clears the location reference — the record itself isn&apos;t deleted.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                        disabled={isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {isPending ? "Unlinking…" : "Unlink"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function LinkedItemRow({ item, onChanged }: { item: LocationLinkedItem; onChanged: () => void }) {
    const [editing, setEditing] = useState(false);
    const [picked, setPicked] = useState<LocationValue | null>(null);
    const [isPending, startTransition] = useTransition();
    const meta = KIND_META[item.kind];
    const Icon = meta.icon;

    function handleSave() {
        if (!picked) return;
        startTransition(async () => {
            const result = await relinkLocationReference(item.kind, item.refId, picked.id);
            if (result.success) {
                toast.success(result.message);
                setEditing(false);
                setPicked(null);
                onChanged();
            } else {
                toast.error(result.message);
            }
        });
    }

    function cancelEdit() {
        setEditing(false);
        setPicked(null);
    }

    return (
        <div className="rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${meta.className}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 shrink-0">
                            {meta.label}
                        </span>
                    </div>
                    {item.context && (
                        <p className="text-xs text-muted-foreground truncate">{item.context}</p>
                    )}
                </div>
                {!editing && (
                    <div className="flex items-center gap-0.5 shrink-0">
                        {item.editHref && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Open and edit">
                                <Link href={item.editHref} target="_blank">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                        )}
                        <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Change location"
                            onClick={() => setEditing(true)}
                        >
                            <Repeat className="h-3.5 w-3.5" />
                        </Button>
                        <UnlinkButton item={item} onChanged={onChanged} />
                    </div>
                )}
            </div>

            {editing && (
                <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t">
                    <div className="flex-1 min-w-0">
                        <LocationSearchSelect
                            value={picked}
                            onChange={setPicked}
                            placeholder="Search the correct location…"
                        />
                    </div>
                    <Button
                        size="icon" className="h-9 w-9 shrink-0"
                        disabled={!picked || isPending}
                        onClick={handleSave}
                        title="Save new location"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                        disabled={isPending}
                        onClick={cancelEdit}
                        title="Cancel"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}

export function LinkedItemsSheet({
    locationId,
    locationName,
    linkedCount,
}: {
    locationId: string;
    locationName: string;
    linkedCount: number;
}) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<LocationLinkedItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [isPending, startTransition] = useTransition();

    function load() {
        startTransition(async () => {
            const result = await getLocationLinkedItems(locationId);
            setItems(result);
            setLoaded(true);
        });
    }

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (o && !loaded) load();
    }

    function handleChanged() {
        setLoaded(false);
        load();
    }

    if (linkedCount === 0) {
        return <span className="text-xs text-muted-foreground/50">—</span>;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => handleOpenChange(true)}
                className="flex items-center justify-center gap-1 text-xs text-dashboard-primary hover:underline cursor-pointer mx-auto"
            >
                <Link2 className="h-3 w-3" /> {linkedCount}
            </button>

            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
                    <SheetHeader className="shrink-0 border-b px-6 py-4 gap-1">
                        <SheetTitle className="flex items-center gap-2 text-base">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            Linked Items
                        </SheetTitle>
                        <SheetDescription className="truncate">{locationName}</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {isPending && !loaded ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <p className="text-sm">Loading linked items…</p>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                                <p className="text-sm font-medium">Nothing linked anymore</p>
                                <p className="text-xs">Every reference to this location has been unlinked or moved</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <LinkedItemRow
                                        key={`${item.kind}-${item.refId}`}
                                        item={item}
                                        onChanged={handleChanged}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
