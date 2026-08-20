"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Merge, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { QuickHotel } from "../catalog-actions";
import { previewHotelMerge, mergeHotels, type MergePreview } from "../hotel-merge-actions";

/**
 * One quick-created property, with its gaps and — when it shares a name with
 * something already on file — a merge that shows exactly what would move before
 * it moves anything.
 */
export function QuickHotelRow({ hotel }: { hotel: QuickHotel }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [preview, setPreview] = useState<MergePreview | null>(null);

    const dup = hotel.duplicateOf[0];

    function loadPreview() {
        if (!dup) return;
        startTransition(async () => {
            // The existing record wins: it is the one with the history, and the
            // quick-created stub is the newcomer.
            const p = await previewHotelMerge(dup.id, hotel.id);
            if (!p.ok) { toast.error(p.error ?? "Couldn't work out what would move."); return; }
            setPreview(p);
        });
    }

    function confirmMerge() {
        if (!dup) return;
        startTransition(async () => {
            const res = await mergeHotels(dup.id, hotel.id);
            if (res.success) {
                toast.success(`Merged into ${dup.name} — ${res.movedRows} row${res.movedRows === 1 ? "" : "s"} moved.`);
                setPreview(null);
                router.refresh();
            } else {
                toast.error(res.error ?? "Merge failed.");
            }
        });
    }

    return (
        <div className={`rounded-xl border p-3 space-y-2 ${
            dup ? "border-amber-300 bg-amber-50/50" : "border-dashboard-border bg-dashboard-surface"
        }`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Link
                        href={`/dashboard/hotels/${hotel.id}`}
                        className="text-sm font-semibold text-dashboard-text hover:underline underline-offset-2"
                    >
                        {hotel.name}
                    </Link>
                    <p className="text-[11px] text-dashboard-neutral">
                        {hotel.location ?? "no town on file"}
                        {hotel.starRating ? ` · ${hotel.starRating}` : ""}
                        {` · ${hotel.rooms} room${hotel.rooms === 1 ? "" : "s"}, ${hotel.rates} rate${hotel.rates === 1 ? "" : "s"}`}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-dashboard-text">{hotel.usedInDays}</p>
                    <p className="text-[10px] text-dashboard-neutral">
                        day{hotel.usedInDays === 1 ? "" : "s"} sold
                    </p>
                </div>
            </div>

            {hotel.missing.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {hotel.missing.map((m) => (
                        <span
                            key={m}
                            className="inline-flex items-center rounded-full border border-dashboard-border bg-white text-dashboard-neutral text-[10px] px-1.5 py-0.5"
                        >
                            needs {m}
                        </span>
                    ))}
                </div>
            )}

            {dup && (
                <div className="rounded-md border border-amber-300 bg-white px-2 py-1.5 space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Same name as an existing hotel
                    </p>
                    <p className="text-[11px] text-dashboard-neutral flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-dashboard-text">{hotel.name}</span>
                        <span>({hotel.location ?? "no town"})</span>
                        <ArrowRight className="size-3" />
                        <span className="font-medium text-dashboard-text">{dup.name}</span>
                        <span>({dup.location ?? "no town"})</span>
                    </p>

                    {preview?.ok ? (
                        <div className="space-y-1.5">
                            <p className="text-[11px] text-dashboard-text">
                                {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"} would move onto{" "}
                                <strong>{preview.winner?.name}</strong>, and this record would be deleted.
                            </p>
                            <ul className="text-[10px] text-dashboard-neutral space-y-0.5">
                                {preview.moves?.map((m) => (
                                    <li key={`${m.table}.${m.column}`}>
                                        {m.table} — {m.rows} row{m.rows === 1 ? "" : "s"}
                                    </li>
                                ))}
                            </ul>
                            {!!preview.slugClashes?.length && (
                                <p className="text-[10px] text-amber-800">
                                    {preview.slugClashes.length} room slug
                                    {preview.slugClashes.length === 1 ? "" : "s"} would be renamed to fit — rates and
                                    bookings follow the room id, so nothing downstream changes.
                                </p>
                            )}
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm" className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white"
                                    disabled={isPending} onClick={confirmMerge}
                                >
                                    {isPending ? "Merging…" : "Confirm merge"}
                                </Button>
                                <Button
                                    size="sm" variant="ghost" className="h-7 text-xs"
                                    onClick={() => setPreview(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            disabled={isPending} onClick={loadPreview}
                        >
                            {isPending
                                ? <><Loader2 className="size-3 mr-1 animate-spin" /> Checking…</>
                                : <><Merge className="size-3 mr-1" /> See what would move</>}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
