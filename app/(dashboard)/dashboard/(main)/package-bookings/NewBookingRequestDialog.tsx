"use client";

/**
 * The explicit "request a booking" entry point a sales exec was missing —
 * without this, the only way into the payment-proof flow was already
 * knowing a Booking shell had been auto-created (or not — see
 * tryCreateBookingFromConvertedQuery's silent-failure cases) at query-close
 * time. Lists their own Converted queries in a table, Choose-Template style;
 * picking one jumps straight to (or creates, on the spot) that booking.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, Plus, MapPin, ArrowRight } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { getBookablePackages, requestBooking, type BookablePackageRow } from "./payment-proof.actions";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const BOOKING_STATUS_STYLE: Record<string, string> = {
    PENDING_REVIEW: "bg-amber-100 text-amber-700",
    CONFIRMED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    REJECTED: "bg-red-100 text-red-700",
};

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function NewBookingRequestDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<BookablePackageRow[]>([]);
    const [search, setSearch] = useState("");
    // A query with several packages produces several rows sharing one
    // queryId, so the row key (and the in-flight tracker) has to be the
    // package, falling back to the query for the "no package built" case.
    const [requestingKey, setRequestingKey] = useState<string | null>(null);

    useEffect(() => {
        if (!open) { setSearch(""); return; }
        setLoading(true);
        getBookablePackages().then((r) => { setRows(r); setLoading(false); });
    }, [open]);

    const filtered = rows.filter((q) => {
        const s = search.toLowerCase();
        return !s
            || q.clientName.toLowerCase().includes(s)
            || q.packageTitle.toLowerCase().includes(s)
            || (q.destination ?? "").toLowerCase().includes(s);
    });

    async function handleSelect(q: BookablePackageRow) {
        const key = q.packageId ?? q.queryId;
        setRequestingKey(key);
        try {
            const res = await requestBooking(q.queryId, q.packageId);
            if (!res.success || !res.bookingId) {
                toast.error(res.message);
                return;
            }
            setOpen(false);
            router.push(`/dashboard/package-bookings/${res.bookingId}`);
        } finally {
            setRequestingKey(null);
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-dashboard-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
                <Plus className="size-4" /> New Booking Request
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="px-4 pt-4 pb-3 border-b border-dashboard-base-300">
                        <DialogTitle className="text-sm font-semibold">Request a Booking</DialogTitle>
                        <p className="text-xs text-dashboard-base-content/60 mt-0.5">
                            Pick the exact package the client paid for — if a query had a few options,
                            each shows up separately here so there&rsquo;s no guessing which one won.
                        </p>
                    </DialogHeader>

                    <div className="px-3 pt-3 pb-2">
                        <div className="flex items-center gap-2 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/30 px-3 h-9">
                            <Search className="h-3.5 w-3.5 text-dashboard-base-content/40 shrink-0" />
                            <input
                                autoFocus
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by client, package, destination…"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-dashboard-base-content/40"
                            />
                        </div>
                    </div>

                    <div className="px-3 pb-3 max-h-96 overflow-y-auto space-y-1.5">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-dashboard-base-content/50">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Loading your converted queries…</span>
                            </div>
                        ) : filtered.length === 0 ? (
                            <p className="text-center text-xs text-dashboard-base-content/50 py-8">
                                {search ? "No matches." : "No Converted queries yet — close a query as Converted first."}
                            </p>
                        ) : (
                            filtered.map((q) => (
                                <button
                                    key={q.packageId ?? q.queryId}
                                    disabled={requestingKey === (q.packageId ?? q.queryId)}
                                    onClick={() => handleSelect(q)}
                                    className="w-full flex items-center gap-3 rounded-lg border border-dashboard-base-300 px-3 py-2.5 text-left transition-colors hover:bg-dashboard-base-200/50 disabled:opacity-50"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-dashboard-base-content truncate">{q.clientName}</p>
                                            {q.bookingStatus && (
                                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${BOOKING_STATUS_STYLE[q.bookingStatus] ?? "bg-dashboard-base-200 text-dashboard-base-content/60"}`}>
                                                    {titleCase(q.bookingStatus)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-dashboard-base-content/60 truncate">{q.packageTitle}</p>
                                        {q.destination && (
                                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-dashboard-base-content/45">
                                                <MapPin className="size-2.5" /> {q.destination}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {q.price != null && (
                                            <span className="text-sm font-semibold text-dashboard-base-content">{inr(q.price)}</span>
                                        )}
                                        {requestingKey === (q.packageId ?? q.queryId)
                                            ? <Loader2 className="size-4 animate-spin text-dashboard-base-content/40" />
                                            : <ArrowRight className="size-4 text-dashboard-base-content/30" />}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
