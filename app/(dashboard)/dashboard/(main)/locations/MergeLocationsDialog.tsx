"use client";

import { useState, useTransition } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { GitMerge, Search, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { LOCATION_TYPES, type LocationTypeValue } from "@/app/lib/validators/locations";
import {
    searchLocationsForMerge, mergeLocations, type LocationMergeCandidate,
} from "./actions";

export function MergeLocationsDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [type, setType] = useState<LocationTypeValue>("CITY");
    const [candidates, setCandidates] = useState<LocationMergeCandidate[]>([]);
    const [searched, setSearched] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [targetId, setTargetId] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isSearching, startSearch] = useTransition();
    const [isMerging, startMerge] = useTransition();

    function resetAll() {
        setName("");
        setCandidates([]);
        setSearched(false);
        setSelectedIds(new Set());
        setTargetId(null);
        setConfirmOpen(false);
    }

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (!o) resetAll();
    }

    function handleSearch() {
        if (name.trim().length < 2) return;
        startSearch(async () => {
            const { candidates: results } = await searchLocationsForMerge(name.trim(), type);
            setCandidates(results);
            setSearched(true);
            setSelectedIds(new Set());
            // Default target = the one with the most existing links — most
            // likely the "real" one worth keeping, freely reassignable below.
            const best = results.reduce<LocationMergeCandidate | null>(
                (a, b) => (a == null || b.linkedCount > a.linkedCount ? b : a), null,
            );
            setTargetId(best?.id ?? null);
        });
    }

    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id));
    const canProceed = selectedIds.size >= 2 && targetId != null && selectedIds.has(targetId);
    const targetCandidate = candidates.find((c) => c.id === targetId) ?? null;
    const sourceCandidates = selectedCandidates.filter((c) => c.id !== targetId);
    const totalToMove = sourceCandidates.reduce((sum, c) => sum + c.linkedCount, 0);

    function handleConfirm() {
        if (!targetId) return;
        startMerge(async () => {
            const result = await mergeLocations(targetId, sourceCandidates.map((c) => c.id));
            if (result.success) {
                toast.success(result.message);
                setConfirmOpen(false);
                setOpen(false);
                resetAll();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <>
            <Button
                variant="outline"
                onClick={() => handleOpenChange(true)}
                className="rounded-md py-2.5 px-4"
            >
                <GitMerge className="mr-2 h-4 w-4" />
                Merge Duplicates
            </Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Merge Duplicate Locations</DialogTitle>
                        <DialogDescription>
                            Search for duplicates by name and type, pick which ones to merge, and choose which one to
                            keep — every hotel, activity, route stop, transfer, cab-pricing and permit link moves to
                            it automatically, and the others are deleted.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2">
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="e.g. Jaipur"
                            className="flex-1"
                        />
                        <Select value={type} onValueChange={(v) => setType(v as LocationTypeValue)}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {LOCATION_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleSearch} disabled={isSearching || name.trim().length < 2}>
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>

                    {searched && (
                        candidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">No matches found.</p>
                        ) : candidates.length === 1 ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">Only one match — nothing to merge.</p>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {candidates.map((c) => (
                                    <div
                                        key={c.id}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                                            selectedIds.has(c.id) ? "border-dashboard-primary bg-dashboard-primary/5" : "border-dashboard-base-300",
                                        )}
                                    >
                                        <Checkbox checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{c.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono truncate">{c.slug}</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs shrink-0">{c.linkedCount} linked</Badge>
                                        {selectedIds.has(c.id) && (
                                            <Button
                                                type="button" size="sm"
                                                variant={targetId === c.id ? "default" : "outline"}
                                                onClick={() => setTargetId(c.id)}
                                                className="shrink-0 gap-1"
                                            >
                                                <Star className="h-3 w-3" />
                                                {targetId === c.id ? "Keeping this" : "Keep this"}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {canProceed && (
                        <p className="text-xs text-dashboard-base-content/60 rounded-md bg-dashboard-base-200/60 px-3 py-2">
                            {sourceCandidates.length} location{sourceCandidates.length === 1 ? "" : "s"} will be merged into{" "}
                            <span className="font-semibold">{targetCandidate?.name}</span> — {totalToMove} link{totalToMove === 1 ? "" : "s"} will
                            move, then {sourceCandidates.length === 1 ? "it" : "they"} will be deleted.
                        </p>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
                        <Button disabled={!canProceed} onClick={() => setConfirmOpen(true)}>
                            Preview &amp; Merge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm merge</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-semibold">{sourceCandidates.map((c) => c.name).join(", ")}</span> will
                            be permanently deleted, and every link they hold ({totalToMove} total) will move to{" "}
                            <span className="font-semibold">{targetCandidate?.name}</span>. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isMerging}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                            disabled={isMerging}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {isMerging ? "Merging…" : "Merge & Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
